/**
 * Pasarela v2.0
 * Gateway de comunicación inmutable
 * 
 * API de eventos (sin cambios desde v1):
 * - identificar: Identificar usuario
 * - notificar: Enviar notificaciones  
 * - pasarela: Canal de mensajes genérico
 * 
 * Destinos:
 * - yo: Solo al emisor
 * - ustedes: A todos menos el emisor
 * - nosotros: A todos incluyendo el emisor
 * 
 * Mejoras internas v2:
 * - Socket.io 4.x
 * - Redis Adapter para escalabilidad horizontal
 * - Kafka para eventos asíncronos (opcional)
 * - Métricas Prometheus
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Kafka } from 'kafkajs';
import { register, collectDefaultMetrics, Counter, Gauge } from 'prom-client';
import 'dotenv/config';

// ============================================
// CONFIGURACIÓN
// ============================================
const PORT = process.env.PORT || 5000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : null;
const INSTANCE_ID = process.env.INSTANCE_ID || process.pid.toString();

console.log('Iniciando...');
console.log(`Puerto: ${PORT}`);
console.log(`Instancia: ${INSTANCE_ID}`);

// ============================================
// MÉTRICAS (opcional, para monitoreo)
// ============================================
collectDefaultMetrics({ register });

const metricsConnections = new Gauge({
  name: 'pasarela_connections_total',
  help: 'Conexiones activas'
});

const metricsMessages = new Counter({
  name: 'pasarela_messages_total',
  help: 'Mensajes procesados',
  labelNames: ['type', 'destination']
});

// ============================================
// REDIS (para escalabilidad horizontal)
// ============================================
let pubClient, subClient;

try {
  pubClient = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
  subClient = pubClient.duplicate();
  
  pubClient.on('connect', () => console.log('Redis conectado'));
  pubClient.on('error', (err) => console.error('Redis error:', err.message));
} catch (error) {
  console.log('Redis no disponible, modo standalone');
}

// ============================================
// KAFKA (opcional, para eventos asíncronos)
// ============================================
let kafkaProducer = null;

async function initKafka() {
  if (!KAFKA_BROKERS) return;
  
  try {
    const kafka = new Kafka({
      clientId: `pasarela-${INSTANCE_ID}`,
      brokers: KAFKA_BROKERS,
      retry: { retries: 3 }
    });
    
    kafkaProducer = kafka.producer();
    await kafkaProducer.connect();
    console.log('Kafka conectado');
  } catch (error) {
    console.log('Kafka no disponible:', error.message);
    kafkaProducer = null;
  }
}

// ============================================
// HTTP SERVER
// ============================================
const httpServer = createServer((req, res) => {
  // Health check
  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      status: 'ok',
      instance: INSTANCE_ID,
      connections: io.of('/pasarela').sockets.size
    }));
    return;
  }
  
  // Métricas Prometheus
  if (req.url === '/metrics') {
    res.setHeader('Content-Type', register.contentType);
    register.metrics().then(data => res.end(data));
    return;
  }
  
  res.statusCode = 404;
  res.end('Pasarela Gateway');
});

// ============================================
// SOCKET.IO
// ============================================
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
});

// Usar Redis Adapter si está disponible
if (pubClient && subClient) {
  io.adapter(createAdapter(pubClient, subClient));
}

// ============================================
// NAMESPACE /pasarela - API INMUTABLE
// ============================================
const pasarela = io.of('/pasarela');

pasarela.on('connection', function(socket) {
  console.log('Conectado:', socket.id);
  metricsConnections.inc();
  
  // EVENTO: identificar
  socket.on('identificar', function(usuario, fn) {
    socket.data.usuario = usuario;
    console.log(`Usuario: ${usuario} se ha conectado`);
    if (typeof fn === 'function') fn(true);
    
    // Publicar a Kafka (si disponible)
    publishToKafka('user_connected', { usuario, socketId: socket.id });
  });
  
  // EVENTO: notificar
  socket.on('notificar', function(data) {
    metricsMessages.inc({ type: 'notificar', destination: data.destino || 'yo' });
    
    switch(data.destino) {
      case 'ustedes':
        socket.broadcast.emit('notificar', data);
        break;
      case 'nosotros':
        pasarela.emit('notificar', data);
        break;
      default: // "yo"
        socket.emit('notificar', data);
        break;
    }
  });
  
  // EVENTO: pasarela (canal genérico)
  socket.on('pasarela', function(data) {
    metricsMessages.inc({ type: 'pasarela', destination: data.destino || 'yo' });
    
    switch(data.destino) {
      case 'ustedes':
        socket.broadcast.emit('pasarela', data);
        break;
      case 'nosotros':
        pasarela.emit('pasarela', data);
        break;
      default: // "yo"
        socket.emit('pasarela', data);
        break;
    }
    
    // Publicar a Kafka (si disponible)
    publishToKafka('message', { from: socket.data.usuario, data });
  });
  
  // Desconexión
  socket.on('disconnect', function(reason) {
    console.log('Desconectado:', socket.id, reason);
    metricsConnections.dec();
    publishToKafka('user_disconnected', { usuario: socket.data.usuario, reason });
  });
});

// ============================================
// UTILIDADES
// ============================================
async function publishToKafka(type, data) {
  if (!kafkaProducer) return;
  
  try {
    await kafkaProducer.send({
      topic: 'pasarela-events',
      messages: [{
        key: type,
        value: JSON.stringify({ type, ...data, timestamp: Date.now(), instance: INSTANCE_ID })
      }]
    });
  } catch (error) {
    // Silencioso - Kafka es opcional
  }
}

// ============================================
// INICIAR
// ============================================
async function start() {
  await initKafka();
  
  httpServer.listen(PORT, () => {
    console.log(`Pasarela escuchando en puerto ${PORT}`);
  });
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Cerrando...');
  if (kafkaProducer) await kafkaProducer.disconnect();
  if (pubClient) pubClient.quit();
  if (subClient) subClient.quit();
  process.exit(0);
});
