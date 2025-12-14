/**
 * Coderic Relay v2.0
 * Real-time messaging infrastructure - Versión como paquete npm
 * 
 * API de eventos:
 * - identificar: Identificar usuario
 * - notificar: Enviar notificaciones  
 * - relay: Canal de mensajes genérico
 * 
 * Destinos:
 * - yo: Solo al emisor
 * - ustedes: A todos menos el emisor
 * - nosotros: A todos incluyendo el emisor
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Kafka } from 'kafkajs';
import { register, collectDefaultMetrics, Counter, Gauge } from 'prom-client';
import EventEmitter from 'events';
import { registerPlugin, getPlugin } from './plugins/index.js';

/**
 * Clase principal del gateway Relay
 */
export class Relay extends EventEmitter {
  /**
   * @param {Object} options - Opciones de configuración
   * @param {number} [options.port=5000] - Puerto del servidor
   * @param {string} [options.instanceId] - ID de instancia para clustering
   * @param {Object} [options.redis] - Configuración de Redis
   * @param {string} [options.redis.url] - URL de Redis
   * @param {Object} [options.kafka] - Configuración de Kafka
   * @param {string[]} [options.kafka.brokers] - Lista de brokers Kafka
   * @param {Object} [options.cors] - Configuración CORS
   * @param {boolean} [options.metrics=true] - Habilitar métricas Prometheus
   * @param {Function} [options.httpHandler] - Handler HTTP personalizado
   * @param {Object} [options.plugins] - Configuración de plugins opcionales
   * @param {Object} [options.plugins.mongo] - Configuración del plugin MongoDB
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      port: options.port || 5000,
      instanceId: options.instanceId || process.pid.toString(),
      redis: options.redis || null,
      kafka: options.kafka || null,
      plugins: options.plugins || {},
      cors: options.cors || { origin: '*', methods: ['GET', 'POST'] },
      metrics: options.metrics !== false,
      httpHandler: options.httpHandler || null,
      namespace: options.namespace || '/relay'
    };
    
    this.httpServer = null;
    this.io = null;
    this.namespace = null;
    this.monitorNamespace = null;
    this.pubClient = null;
    this.subClient = null;
    this.kafkaProducer = null;
    this.metricsConnections = null;
    this.metricsMessages = null;
    this.logBuffer = []; // Buffer de logs para monitoreo
    this.maxLogBuffer = 1000; // Máximo de logs en buffer
    
    this._setupMetrics();
  }
  
  /**
   * Configura las métricas de Prometheus
   * @private
   */
  _setupMetrics() {
    if (!this.options.metrics) return;
    
    collectDefaultMetrics({ register });
    
    this.metricsConnections = new Gauge({
      name: 'relay_connections_total',
      help: 'Conexiones activas',
      labelNames: ['instance']
    });
    
    this.metricsMessages = new Counter({
      name: 'relay_messages_total',
      help: 'Mensajes procesados',
      labelNames: ['type', 'destination', 'instance']
    });
  }
  
  /**
   * Conecta a Redis para escalabilidad horizontal
   * @private
   */
  async _setupRedis() {
    if (!this.options.redis?.url) return;
    
    try {
      this.pubClient = new Redis(this.options.redis.url, { 
        maxRetriesPerRequest: 3,
        ...this.options.redis.options
      });
      this.subClient = this.pubClient.duplicate();
      
      this._emitLog('success', 'redis', 'Redis adapter conectado', { 
        instance: this.options.instanceId 
      });
      
      await new Promise((resolve, reject) => {
        this.pubClient.once('connect', resolve);
        this.pubClient.once('error', reject);
      });
      
      this.emit('redis:connected');
      console.log(`[Relay ${this.options.instanceId}] Redis conectado`);
    } catch (error) {
      this.emit('redis:error', error);
      console.log(`[Relay ${this.options.instanceId}] Redis no disponible:`, error.message);
    }
  }
  
  /**
   * Conecta a Kafka para eventos asíncronos
   * @private
   */
  async _setupKafka() {
    if (!this.options.kafka?.brokers) return;
    
    try {
      const kafka = new Kafka({
        clientId: `relay-${this.options.instanceId}`,
        brokers: this.options.kafka.brokers,
        retry: { retries: 3 },
        ...this.options.kafka.options
      });
      
      this.kafkaProducer = kafka.producer();
      await this.kafkaProducer.connect();
      
      this._emitLog('success', 'kafka', 'Kafka producer conectado', { 
        instance: this.options.instanceId 
      });
      this.emit('kafka:connected');
      console.log(`[Relay ${this.options.instanceId}] Kafka conectado`);
    } catch (error) {
      this.emit('kafka:error', error);
      console.log(`[Relay ${this.options.instanceId}] Kafka no disponible:`, error.message);
      this.kafkaProducer = null;
    }
  }
  
  /**
   * Configura plugins opcionales
   * @private
   */
  async _setupPlugins() {
    // Plugin MongoDB (opcional)
    if (this.options.plugins.mongo?.url) {
      try {
        const { MongoPlugin } = await import('./plugins/mongo.js');
        const mongoPlugin = new MongoPlugin(this.options.plugins.mongo);
        
        mongoPlugin.on('connected', () => {
          this._emitLog('success', 'mongo', 'MongoDB plugin conectado', { 
            instance: this.options.instanceId 
          });
          this.emit('plugin:mongo:connected');
          console.log(`[Relay ${this.options.instanceId}] MongoDB plugin conectado`);
        });
        
        mongoPlugin.on('error', (error) => {
          this.emit('plugin:mongo:error', error);
          console.log(`[Relay ${this.options.instanceId}] MongoDB plugin error:`, error.message);
        });
        
        await mongoPlugin.initialize();
        registerPlugin('mongo', mongoPlugin);
      } catch (error) {
        this.emit('plugin:mongo:error', error);
        console.log(`[Relay ${this.options.instanceId}] MongoDB plugin no disponible:`, error.message);
      }
    }
  }
  
  /**
   * Publica un evento a Kafka
   * @param {string} type - Tipo de evento
   * @param {Object} data - Datos del evento
   */
  async publishToKafka(type, data) {
    if (!this.kafkaProducer) return;
    
    try {
      await this.kafkaProducer.send({
        topic: this.options.kafka?.topic || 'relay-events',
        messages: [{
          key: type,
          value: JSON.stringify({ 
            type, 
            ...data, 
            timestamp: Date.now(), 
            instance: this.options.instanceId 
          })
        }]
      });
    } catch (error) {
      this.emit('kafka:publish:error', error);
    }
  }
  
  /**
   * Configura el servidor HTTP
   * @private
   */
  _setupHttpServer() {
    this.httpServer = createServer(async (req, res) => {
      // Health check
      if (req.url === '/health') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ 
          status: 'ok',
          instance: this.options.instanceId,
          connections: this.namespace?.sockets.size || 0
        }));
        return;
      }
      
      // Métricas Prometheus
      if (req.url === '/metrics' && this.options.metrics) {
        res.setHeader('Content-Type', register.contentType);
        res.end(await register.metrics());
        return;
      }
      
      // Handler personalizado
      if (this.options.httpHandler) {
        return this.options.httpHandler(req, res);
      }
      
      res.statusCode = 404;
      res.end('Coderic Relay');
    });
  }
  
  /**
   * Configura Socket.io y el namespace
   * @private
   */
  _setupSocketIO() {
    this.io = new Server(this.httpServer, {
      cors: this.options.cors,
      transports: ['websocket', 'polling']
    });
    
    // Usar Redis Adapter si está disponible
    if (this.pubClient && this.subClient) {
      this.io.adapter(createAdapter(this.pubClient, this.subClient));
    }
    
    // Namespace principal
    this.namespace = this.io.of(this.options.namespace);
    this._setupNamespaceHandlers();
    
    // Namespace de monitoreo
    this.monitorNamespace = this.io.of('/monitor');
    this._setupMonitorNamespace();
  }
  
  /**
   * Emite un log al namespace de monitoreo
   * @private
   */
  _emitLog(level, category, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level, // info, warn, error, success
      category, // connection, message, system, kafka, redis
      message,
      instance: this.options.instanceId,
      data
    };
    
    // Agregar al buffer
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.maxLogBuffer) {
      this.logBuffer.shift(); // Remover el más antiguo
    }
    
    // Emitir a todos los clientes conectados al monitor
    if (this.monitorNamespace) {
      this.monitorNamespace.emit('log', logEntry);
    }
  }
  
  /**
   * Configura el namespace de monitoreo
   * @private
   */
  _setupMonitorNamespace() {
    this.monitorNamespace.on('connection', (socket) => {
      this._emitLog('info', 'system', 'Cliente de monitoreo conectado', { socketId: socket.id });
      
      // Enviar logs históricos al nuevo cliente
      socket.emit('logs:history', this.logBuffer.slice(-100)); // Últimos 100 logs
      
      // Enviar estadísticas iniciales
      socket.emit('stats', this.getStats());
      
      socket.on('disconnect', () => {
        this._emitLog('info', 'system', 'Cliente de monitoreo desconectado', { socketId: socket.id });
      });
    });
    
    // Emitir estadísticas periódicamente a todos los clientes de monitoreo
    setInterval(() => {
      if (this.monitorNamespace) {
        this.monitorNamespace.emit('stats', this.getStats());
      }
    }, 2000); // Cada 2 segundos
  }
  
  /**
   * Configura los handlers del namespace - API inmutable
   * @private
   */
  _setupNamespaceHandlers() {
    const self = this;
    
    this.namespace.on('connection', function(socket) {
      console.log(`[Relay ${self.options.instanceId}] Conectado:`, socket.id);
      
      if (self.metricsConnections) {
        self.metricsConnections.inc({ instance: self.options.instanceId });
      }
      
      self._emitLog('success', 'connection', 'Nueva conexión', { 
        socketId: socket.id,
        instance: self.options.instanceId 
      });
      
      self.emit('connection', socket);
      
      // EVENTO: identificar
      socket.on('identificar', async function(usuario, fn) {
        socket.data.usuario = usuario;
        console.log(`[Relay ${self.options.instanceId}] Usuario: ${usuario} identificado`);
        
        if (typeof fn === 'function') fn(true);
        
        self._emitLog('info', 'connection', 'Usuario identificado', { 
          usuario, 
          socketId: socket.id,
          instance: self.options.instanceId 
        });
        
        // Persistir conexión en MongoDB (si el plugin está activo)
        const mongoPlugin = getPlugin('mongo');
        if (mongoPlugin?.isEnabled()) {
          await mongoPlugin.saveConnection({
            socketId: socket.id,
            usuario,
            instance: self.options.instanceId,
            connectedAt: new Date()
          });
        }
        
        self.emit('user:identified', { usuario, socketId: socket.id });
        self.publishToKafka('user_connected', { usuario, socketId: socket.id });
      });
      
      // EVENTO: notificar
      socket.on('notificar', function(data) {
        if (self.metricsMessages) {
          self.metricsMessages.inc({ 
            type: 'notificar', 
            destination: data.destino || 'yo',
            instance: self.options.instanceId 
          });
        }
        
        self.emit('notify', { socket, data });
        
        switch(data.destino) {
          case 'ustedes':
            socket.broadcast.emit('notificar', data);
            break;
          case 'nosotros':
            self.namespace.emit('notificar', data);
            break;
          default: // "yo"
            socket.emit('notificar', data);
            break;
        }
      });
      
      // EVENTO: relay (canal genérico)
      socket.on('relay', async function(data) {
        if (self.metricsMessages) {
          self.metricsMessages.inc({ 
            type: 'relay', 
            destination: data.destino || 'yo',
            instance: self.options.instanceId 
          });
        }
        
        self._emitLog('info', 'message', 'Mensaje recibido', { 
          usuario: socket.data.usuario || 'anónimo',
          socketId: socket.id,
          destino: data.destino || 'yo',
          tipo: data.tipo || 'sin-tipo',
          instance: self.options.instanceId,
          dataSize: JSON.stringify(data).length
        });
        
        // Persistir mensaje en MongoDB (si el plugin está activo)
        const mongoPlugin = getPlugin('mongo');
        if (mongoPlugin?.isEnabled()) {
          await mongoPlugin.saveMessage({
            usuario: socket.data.usuario || 'anónimo',
            socketId: socket.id,
            destino: data.destino || 'yo',
            tipo: data.tipo || 'sin-tipo',
            data: data,
            instance: self.options.instanceId
          });
        }
        
        self.emit('message', { socket, data });
        
        switch(data.destino) {
          case 'ustedes':
            socket.broadcast.emit('relay', data);
            break;
          case 'nosotros':
            self.namespace.emit('relay', data);
            break;
          default: // "yo"
            socket.emit('relay', data);
            break;
        }
        
        self.publishToKafka('message', { from: socket.data.usuario, data });
      });
      
      // Desconexión
      socket.on('disconnect', async function(reason) {
        console.log(`[Relay ${self.options.instanceId}] Desconectado:`, socket.id, reason);
        
        if (self.metricsConnections) {
          self.metricsConnections.dec({ instance: self.options.instanceId });
        }
        
        self._emitLog('warn', 'connection', 'Conexión cerrada', { 
          socketId: socket.id,
          usuario: socket.data.usuario || 'anónimo',
          reason,
          instance: self.options.instanceId 
        });
        
        // Actualizar desconexión en MongoDB (si el plugin está activo)
        const mongoPlugin = getPlugin('mongo');
        if (mongoPlugin?.isEnabled()) {
          await mongoPlugin.updateConnectionDisconnect(socket.id, reason);
        }
        
        self.emit('disconnect', { socket, reason });
        self.publishToKafka('user_disconnected', { usuario: socket.data.usuario, reason });
      });
    });
  }
  
  /**
   * Inicia el servidor Relay
   * @returns {Promise<void>}
   */
  async start() {
    await this._setupRedis();
    await this._setupKafka();
    await this._setupPlugins();
    this._setupHttpServer();
    this._setupSocketIO();
    
      return new Promise((resolve) => {
      this.httpServer.listen(this.options.port, () => {
        console.log(`[Relay ${this.options.instanceId}] Escuchando en puerto ${this.options.port}`);
        this._emitLog('success', 'system', 'Servidor iniciado', { 
          port: this.options.port,
          instance: this.options.instanceId 
        });
        this.emit('ready', { port: this.options.port });
        resolve();
      });
    });
  }
  
  /**
   * Detiene el servidor gracefully
   * @returns {Promise<void>}
   */
  async stop() {
    console.log(`[Relay ${this.options.instanceId}] Cerrando...`);
    
    // Cerrar plugins
    const mongoPlugin = getPlugin('mongo');
    if (mongoPlugin?.isEnabled()) {
      await mongoPlugin.shutdown();
    }
    
    if (this.kafkaProducer) {
      await this.kafkaProducer.disconnect();
    }
    
    if (this.pubClient) {
      this.pubClient.quit();
    }
    
    if (this.subClient) {
      this.subClient.quit();
    }
    
    if (this.io) {
      await this.io.close();
    }
    
    if (this.httpServer) {
      await new Promise((resolve) => this.httpServer.close(resolve));
    }
    
    this.emit('closed');
  }
  
  /**
   * Obtiene el objeto Socket.io para uso avanzado
   * @returns {Server}
   */
  getIO() {
    return this.io;
  }
  
  /**
   * Obtiene el namespace principal
   * @returns {Namespace}
   */
  getNamespace() {
    return this.namespace;
  }
  
  /**
   * Obtiene estadísticas actuales
   * @returns {Object}
   */
  getStats() {
    const mongoPlugin = getPlugin('mongo');
    return {
      connections: this.namespace?.sockets.size || 0,
      instance: this.options.instanceId,
      redis: !!this.pubClient,
      kafka: !!this.kafkaProducer,
      mongo: mongoPlugin?.isConnected() || false
    };
  }
}

/**
 * Factory function para crear una instancia de Relay
 * @param {Object} options - Opciones de configuración
 * @returns {Relay}
 */
export function createRelay(options = {}) {
  return new Relay(options);
}

export default Relay;

