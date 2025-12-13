/**
 * Pasarela v2.0
 * Gateway de comunicación inmutable - Versión como paquete npm
 * 
 * API de eventos:
 * - identificar: Identificar usuario
 * - notificar: Enviar notificaciones  
 * - pasarela: Canal de mensajes genérico
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

/**
 * Clase principal del gateway Pasarela
 */
export class Pasarela extends EventEmitter {
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
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      port: options.port || 5000,
      instanceId: options.instanceId || process.pid.toString(),
      redis: options.redis || null,
      kafka: options.kafka || null,
      cors: options.cors || { origin: '*', methods: ['GET', 'POST'] },
      metrics: options.metrics !== false,
      httpHandler: options.httpHandler || null,
      namespace: options.namespace || '/pasarela'
    };
    
    this.httpServer = null;
    this.io = null;
    this.namespace = null;
    this.pubClient = null;
    this.subClient = null;
    this.kafkaProducer = null;
    this.metricsConnections = null;
    this.metricsMessages = null;
    
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
      name: 'pasarela_connections_total',
      help: 'Conexiones activas',
      labelNames: ['instance']
    });
    
    this.metricsMessages = new Counter({
      name: 'pasarela_messages_total',
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
      
      await new Promise((resolve, reject) => {
        this.pubClient.once('connect', resolve);
        this.pubClient.once('error', reject);
      });
      
      this.emit('redis:connected');
      console.log(`[Pasarela ${this.options.instanceId}] Redis conectado`);
    } catch (error) {
      this.emit('redis:error', error);
      console.log(`[Pasarela ${this.options.instanceId}] Redis no disponible:`, error.message);
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
        clientId: `pasarela-${this.options.instanceId}`,
        brokers: this.options.kafka.brokers,
        retry: { retries: 3 },
        ...this.options.kafka.options
      });
      
      this.kafkaProducer = kafka.producer();
      await this.kafkaProducer.connect();
      
      this.emit('kafka:connected');
      console.log(`[Pasarela ${this.options.instanceId}] Kafka conectado`);
    } catch (error) {
      this.emit('kafka:error', error);
      console.log(`[Pasarela ${this.options.instanceId}] Kafka no disponible:`, error.message);
      this.kafkaProducer = null;
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
        topic: this.options.kafka?.topic || 'pasarela-events',
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
      res.end('Pasarela Gateway');
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
  }
  
  /**
   * Configura los handlers del namespace - API inmutable
   * @private
   */
  _setupNamespaceHandlers() {
    const self = this;
    
    this.namespace.on('connection', function(socket) {
      console.log(`[Pasarela ${self.options.instanceId}] Conectado:`, socket.id);
      
      if (self.metricsConnections) {
        self.metricsConnections.inc({ instance: self.options.instanceId });
      }
      
      self.emit('connection', socket);
      
      // EVENTO: identificar
      socket.on('identificar', function(usuario, fn) {
        socket.data.usuario = usuario;
        console.log(`[Pasarela ${self.options.instanceId}] Usuario: ${usuario} identificado`);
        
        if (typeof fn === 'function') fn(true);
        
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
      
      // EVENTO: pasarela (canal genérico)
      socket.on('pasarela', function(data) {
        if (self.metricsMessages) {
          self.metricsMessages.inc({ 
            type: 'pasarela', 
            destination: data.destino || 'yo',
            instance: self.options.instanceId 
          });
        }
        
        self.emit('message', { socket, data });
        
        switch(data.destino) {
          case 'ustedes':
            socket.broadcast.emit('pasarela', data);
            break;
          case 'nosotros':
            self.namespace.emit('pasarela', data);
            break;
          default: // "yo"
            socket.emit('pasarela', data);
            break;
        }
        
        self.publishToKafka('message', { from: socket.data.usuario, data });
      });
      
      // Desconexión
      socket.on('disconnect', function(reason) {
        console.log(`[Pasarela ${self.options.instanceId}] Desconectado:`, socket.id, reason);
        
        if (self.metricsConnections) {
          self.metricsConnections.dec({ instance: self.options.instanceId });
        }
        
        self.emit('disconnect', { socket, reason });
        self.publishToKafka('user_disconnected', { usuario: socket.data.usuario, reason });
      });
    });
  }
  
  /**
   * Inicia el servidor Pasarela
   * @returns {Promise<void>}
   */
  async start() {
    await this._setupRedis();
    await this._setupKafka();
    this._setupHttpServer();
    this._setupSocketIO();
    
    return new Promise((resolve) => {
      this.httpServer.listen(this.options.port, () => {
        console.log(`[Pasarela ${this.options.instanceId}] Escuchando en puerto ${this.options.port}`);
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
    console.log(`[Pasarela ${this.options.instanceId}] Cerrando...`);
    
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
    return {
      connections: this.namespace?.sockets.size || 0,
      instance: this.options.instanceId,
      redis: !!this.pubClient,
      kafka: !!this.kafkaProducer
    };
  }
}

/**
 * Factory function para crear una instancia de Pasarela
 * @param {Object} options - Opciones de configuración
 * @returns {Pasarela}
 */
export function createPasarela(options = {}) {
  return new Pasarela(options);
}

export default Pasarela;

