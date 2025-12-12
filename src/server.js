import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Kafka } from 'kafkajs';
import { register, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';
import 'dotenv/config';

// ============================================
// CONFIGURACIÓN
// ============================================
const PORT = process.env.PORT || 5000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

console.log('🚀 Iniciando Pasarela v2.0...');
console.log(`📡 Puerto: ${PORT}`);
console.log(`🔴 Redis: ${REDIS_URL}`);
console.log(`📨 Kafka: ${KAFKA_BROKERS.join(', ')}`);

// ============================================
// MÉTRICAS PROMETHEUS
// ============================================
collectDefaultMetrics({ register });

const metricsConnections = new Gauge({
  name: 'pasarela_connections_total',
  help: 'Número total de conexiones activas'
});

const metricsMessages = new Counter({
  name: 'pasarela_messages_total',
  help: 'Total de mensajes procesados',
  labelNames: ['type', 'destination']
});

const metricsLatency = new Histogram({
  name: 'pasarela_message_latency_seconds',
  help: 'Latencia de procesamiento de mensajes',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});

// ============================================
// REDIS
// ============================================
const pubClient = new Redis(REDIS_URL, {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
});

const subClient = pubClient.duplicate();

pubClient.on('connect', () => console.log('✅ Redis PUB conectado'));
subClient.on('connect', () => console.log('✅ Redis SUB conectado'));
pubClient.on('error', (err) => console.error('❌ Redis PUB error:', err.message));
subClient.on('error', (err) => console.error('❌ Redis SUB error:', err.message));

// ============================================
// KAFKA
// ============================================
const kafka = new Kafka({
  clientId: 'pasarela',
  brokers: KAFKA_BROKERS,
  retry: {
    initialRetryTime: 100,
    retries: 5
  }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'pasarela-group' });

async function initKafka() {
  try {
    await producer.connect();
    console.log('✅ Kafka Producer conectado');

    await consumer.connect();
    await consumer.subscribe({ topics: ['pasarela-events', 'pasarela-notifications'], fromBeginning: false });
    console.log('✅ Kafka Consumer suscrito');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const data = JSON.parse(message.value.toString());
        console.log(`📥 Kafka [${topic}]:`, data);
        
        // Reenviar a todos los clientes Socket.io
        io.of('/pasarela').emit(topic.replace('pasarela-', ''), data);
      }
    });
  } catch (error) {
    console.error('❌ Error inicializando Kafka:', error.message);
  }
}

// ============================================
// HTTP SERVER + SOCKET.IO
// ============================================
const httpServer = createServer(async (req, res) => {
  // Endpoint de métricas para Prometheus
  if (req.url === '/metrics') {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
    return;
  }

  // Health check
  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      status: 'ok', 
      uptime: process.uptime(),
      connections: io.of('/pasarela').sockets.size
    }));
    return;
  }

  // Servir página de prueba
  if (req.url === '/' || req.url === '/index.html') {
    res.setHeader('Content-Type', 'text/html');
    res.end(getTestPage());
    return;
  }

  res.statusCode = 404;
  res.end('Not Found');
});

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Usar Redis Adapter para escalabilidad horizontal
io.adapter(createAdapter(pubClient, subClient));

// ============================================
// NAMESPACE /pasarela
// ============================================
const pasarela = io.of('/pasarela');

pasarela.use((socket, next) => {
  // Middleware de autenticación (expandible)
  const token = socket.handshake.auth.token;
  console.log(`🔐 Autenticando socket ${socket.id}`);
  next();
});

pasarela.on('connection', async (socket) => {
  console.log(`🔌 Conectado: ${socket.id}`);
  metricsConnections.inc();

  // Almacenar en Redis
  await pubClient.hset('pasarela:connections', socket.id, JSON.stringify({
    connectedAt: new Date().toISOString(),
    ip: socket.handshake.address
  }));

  // Identificar usuario
  socket.on('identificar', async (usuario, callback) => {
    socket.data.usuario = usuario;
    await pubClient.hset('pasarela:usuarios', socket.id, usuario);
    console.log(`👤 Usuario identificado: ${usuario} (${socket.id})`);
    
    // Publicar evento a Kafka
    await producer.send({
      topic: 'pasarela-events',
      messages: [{
        key: socket.id,
        value: JSON.stringify({ 
          type: 'user_connected', 
          usuario, 
          socketId: socket.id,
          timestamp: Date.now()
        })
      }]
    });

    if (typeof callback === 'function') callback(true);
  });

  // Notificar
  socket.on('notificar', async (data) => {
    const start = Date.now();
    metricsMessages.inc({ type: 'notificar', destination: data.destino || 'yo' });

    // Guardar en Redis
    await pubClient.lpush('pasarela:notifications', JSON.stringify({
      ...data,
      from: socket.id,
      timestamp: Date.now()
    }));
    await pubClient.ltrim('pasarela:notifications', 0, 99); // Mantener últimas 100

    switch (data.destino) {
      case 'ustedes':
        socket.broadcast.emit('notificar', data);
        break;
      case 'nosotros':
        pasarela.emit('notificar', data);
        break;
      default: // "yo"
        socket.emit('notificar', data);
    }

    metricsLatency.observe((Date.now() - start) / 1000);
  });

  // Pasarela de mensajes
  socket.on('pasarela', async (data) => {
    const start = Date.now();
    metricsMessages.inc({ type: 'pasarela', destination: data.destino || 'yo' });

    // Publicar a Kafka para procesamiento asíncrono
    await producer.send({
      topic: 'pasarela-events',
      messages: [{
        key: socket.id,
        value: JSON.stringify({
          type: 'message',
          from: socket.data.usuario || socket.id,
          data,
          timestamp: Date.now()
        })
      }]
    });

    switch (data.destino) {
      case 'ustedes':
        socket.broadcast.emit('pasarela', data);
        break;
      case 'nosotros':
        pasarela.emit('pasarela', data);
        break;
      default:
        socket.emit('pasarela', data);
    }

    metricsLatency.observe((Date.now() - start) / 1000);
  });

  // Desconexión
  socket.on('disconnect', async (reason) => {
    console.log(`🔌 Desconectado: ${socket.id} (${reason})`);
    metricsConnections.dec();

    await pubClient.hdel('pasarela:connections', socket.id);
    await pubClient.hdel('pasarela:usuarios', socket.id);

    await producer.send({
      topic: 'pasarela-events',
      messages: [{
        key: socket.id,
        value: JSON.stringify({
          type: 'user_disconnected',
          usuario: socket.data.usuario,
          socketId: socket.id,
          reason,
          timestamp: Date.now()
        })
      }]
    });
  });
});

// ============================================
// PÁGINA DE PRUEBA
// ============================================
function getTestPage() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pasarela v2.0</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%);
      min-height: 100vh;
      color: #e0e0e0;
      padding: 2rem;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { 
      font-size: 2.5rem;
      background: linear-gradient(90deg, #00d9ff, #ff6b6b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    .subtitle { color: #888; margin-bottom: 2rem; }
    .status { 
      display: flex; 
      gap: 1rem; 
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }
    .badge {
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .badge.connected { background: rgba(0, 255, 136, 0.15); border: 1px solid #00ff88; }
    .badge.disconnected { background: rgba(255, 68, 68, 0.15); border: 1px solid #ff4444; }
    .badge.info { background: rgba(0, 217, 255, 0.15); border: 1px solid #00d9ff; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot.green { background: #00ff88; box-shadow: 0 0 10px #00ff88; }
    .dot.red { background: #ff4444; }
    .dot.blue { background: #00d9ff; }
    .panel {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .panel h2 { font-size: 1rem; color: #00d9ff; margin-bottom: 1rem; }
    .log {
      background: #0a0a1a;
      border-radius: 8px;
      padding: 1rem;
      height: 200px;
      overflow-y: auto;
      font-size: 0.8rem;
      line-height: 1.6;
    }
    .log-entry { margin-bottom: 0.25rem; }
    .log-entry.info { color: #00d9ff; }
    .log-entry.success { color: #00ff88; }
    .log-entry.error { color: #ff6b6b; }
    .log-entry .time { color: #666; }
    .controls { display: flex; gap: 1rem; flex-wrap: wrap; }
    input, button {
      padding: 0.75rem 1rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
      font-family: inherit;
      font-size: 0.9rem;
    }
    input { flex: 1; min-width: 200px; }
    input:focus { outline: none; border-color: #00d9ff; }
    button {
      background: linear-gradient(135deg, #00d9ff, #0099cc);
      border: none;
      cursor: pointer;
      font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover { 
      transform: translateY(-2px); 
      box-shadow: 0 5px 20px rgba(0, 217, 255, 0.3);
    }
    button:active { transform: translateY(0); }
    .buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .btn-secondary {
      background: rgba(255, 107, 107, 0.2);
      border: 1px solid #ff6b6b;
    }
    .btn-tertiary {
      background: rgba(0, 255, 136, 0.2);
      border: 1px solid #00ff88;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚡ Pasarela v2.0</h1>
    <p class="subtitle">Comunicación en tiempo real con Socket.io, Redis y Kafka</p>
    
    <div class="status">
      <div class="badge disconnected" id="socket-status">
        <span class="dot red" id="socket-dot"></span>
        <span id="socket-text">Desconectado</span>
      </div>
      <div class="badge info">
        <span class="dot blue"></span>
        <span id="session-id">-</span>
      </div>
    </div>

    <div class="panel">
      <h2>📝 Identificación</h2>
      <div class="controls">
        <input type="text" id="username" placeholder="Tu nombre de usuario" value="webmaster">
        <button onclick="identificar()">Identificar</button>
      </div>
    </div>

    <div class="panel">
      <h2>📨 Enviar Mensaje</h2>
      <div class="controls" style="margin-bottom: 1rem;">
        <input type="text" id="mensaje" placeholder="Escribe tu mensaje...">
      </div>
      <div class="buttons">
        <button onclick="enviar('yo')">A mí</button>
        <button class="btn-secondary" onclick="enviar('ustedes')">A otros</button>
        <button class="btn-tertiary" onclick="enviar('nosotros')">A todos</button>
      </div>
    </div>

    <div class="panel">
      <h2>📋 Log de Eventos</h2>
      <div class="log" id="log"></div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const log = document.getElementById('log');
    const socketStatus = document.getElementById('socket-status');
    const socketDot = document.getElementById('socket-dot');
    const socketText = document.getElementById('socket-text');
    const sessionId = document.getElementById('session-id');

    function addLog(message, type = 'info') {
      const time = new Date().toLocaleTimeString();
      const entry = document.createElement('div');
      entry.className = 'log-entry ' + type;
      entry.innerHTML = '<span class="time">[' + time + ']</span> ' + message;
      log.appendChild(entry);
      log.scrollTop = log.scrollHeight;
    }

    const socket = io('/pasarela', {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      socketStatus.className = 'badge connected';
      socketDot.className = 'dot green';
      socketText.textContent = 'Conectado';
      sessionId.textContent = socket.id;
      addLog('Conectado al servidor', 'success');
    });

    socket.on('disconnect', (reason) => {
      socketStatus.className = 'badge disconnected';
      socketDot.className = 'dot red';
      socketText.textContent = 'Desconectado';
      addLog('Desconectado: ' + reason, 'error');
    });

    socket.on('notificar', (data) => {
      addLog('📢 Notificación: ' + JSON.stringify(data), 'info');
    });

    socket.on('pasarela', (data) => {
      addLog('📨 Mensaje: ' + JSON.stringify(data), 'success');
    });

    socket.on('events', (data) => {
      addLog('🔔 Evento Kafka: ' + JSON.stringify(data), 'info');
    });

    function identificar() {
      const username = document.getElementById('username').value;
      socket.emit('identificar', username, (ok) => {
        if (ok) addLog('👤 Identificado como: ' + username, 'success');
        else addLog('❌ Error al identificar', 'error');
      });
    }

    function enviar(destino) {
      const mensaje = document.getElementById('mensaje').value;
      socket.emit('pasarela', { 
        destino, 
        mensaje,
        titulo: 'Mensaje de prueba'
      });
      addLog('📤 Enviado (' + destino + '): ' + mensaje, 'info');
    }

    // Auto-identificar al conectar
    socket.on('connect', () => {
      setTimeout(() => identificar(), 500);
    });
  </script>
</body>
</html>`;
}

// ============================================
// INICIAR SERVIDOR
// ============================================
async function start() {
  await initKafka();
  
  httpServer.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║     🚀 PASARELA v2.0 INICIADA              ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║  📡 Servidor:    http://localhost:${PORT}      ║`);
    console.log(`║  📊 Métricas:    http://localhost:${PORT}/metrics ║`);
    console.log(`║  ❤️  Health:     http://localhost:${PORT}/health  ║`);
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
  });
}

start().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Cerrando conexiones...');
  await producer.disconnect();
  await consumer.disconnect();
  pubClient.quit();
  subClient.quit();
  process.exit(0);
});

