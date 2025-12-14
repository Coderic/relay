/**
 * Módulo de persistencia MongoDB para Relay
 * Proporciona almacenamiento opcional de mensajes, conexiones, eventos y logs
 */

import { MongoClient } from 'mongodb';
import EventEmitter from 'events';

/**
 * Clase para manejar la persistencia en MongoDB
 */
export class RelayMongo extends EventEmitter {
  /**
   * @param {Object} options - Opciones de configuración
   * @param {string} options.url - URL de conexión a MongoDB
   * @param {string} options.dbName - Nombre de la base de datos
   * @param {Object} [options.collections] - Nombres de colecciones personalizadas
   */
  constructor(options = {}) {
    super();
    
    this.url = options.url;
    this.dbName = options.dbName || 'relay';
    this.collections = {
      messages: options.collections?.messages || 'messages',
      connections: options.collections?.connections || 'connections',
      events: options.collections?.events || 'events',
      logs: options.collections?.logs || 'logs'
    };
    
    this.client = null;
    this.db = null;
    this.collectionsCache = {};
    this.connected = false;
  }
  
  /**
   * Conecta a MongoDB
   */
  async connect() {
    if (this.connected) return;
    
    try {
      this.client = new MongoClient(this.url, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      
      // Cachear referencias a colecciones
      this.collectionsCache.messages = this.db.collection(this.collections.messages);
      this.collectionsCache.connections = this.db.collection(this.collections.connections);
      this.collectionsCache.events = this.db.collection(this.collections.events);
      this.collectionsCache.logs = this.db.collection(this.collections.logs);
      
      // Crear índices
      await this._createIndexes();
      
      this.connected = true;
      this.emit('connected');
      
      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Crea índices para optimizar consultas
   * @private
   */
  async _createIndexes() {
    try {
      // Índices para mensajes
      await this.collectionsCache.messages.createIndex({ usuario: 1, timestamp: -1 });
      await this.collectionsCache.messages.createIndex({ timestamp: -1 });
      await this.collectionsCache.messages.createIndex({ tipo: 1, timestamp: -1 });
      
      // Índices para conexiones
      await this.collectionsCache.connections.createIndex({ usuario: 1 });
      await this.collectionsCache.connections.createIndex({ socketId: 1 }, { unique: true });
      await this.collectionsCache.connections.createIndex({ connectedAt: -1 });
      await this.collectionsCache.connections.createIndex({ disconnectedAt: 1 });
      
      // Índices para eventos
      await this.collectionsCache.events.createIndex({ timestamp: -1 });
      await this.collectionsCache.events.createIndex({ tipo: 1, timestamp: -1 });
      
      // Índices para logs
      await this.collectionsCache.logs.createIndex({ timestamp: -1 });
      await this.collectionsCache.logs.createIndex({ nivel: 1, timestamp: -1 });
    } catch (error) {
      // Los índices pueden fallar si ya existen, no es crítico
      console.warn('Error creando índices MongoDB:', error.message);
    }
  }
  
  /**
   * Guarda un mensaje
   * @param {Object} message - Datos del mensaje
   */
  async saveMessage(message) {
    if (!this.connected) return;
    
    try {
      await this.collectionsCache.messages.insertOne({
        ...message,
        timestamp: new Date(),
        _id: undefined // MongoDB generará el _id
      });
    } catch (error) {
      this.emit('error', error);
    }
  }
  
  /**
   * Guarda o actualiza una conexión
   * @param {Object} connection - Datos de la conexión
   */
  async saveConnection(connection) {
    if (!this.connected) return;
    
    try {
      await this.collectionsCache.connections.updateOne(
        { socketId: connection.socketId },
        {
          $set: {
            ...connection,
            connectedAt: connection.connectedAt || new Date(),
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
    } catch (error) {
      this.emit('error', error);
    }
  }
  
  /**
   * Actualiza el estado de desconexión
   * @param {string} socketId - ID del socket
   * @param {string} reason - Razón de desconexión
   */
  async updateConnectionDisconnect(socketId, reason) {
    if (!this.connected) return;
    
    try {
      await this.collectionsCache.connections.updateOne(
        { socketId },
        {
          $set: {
            disconnectedAt: new Date(),
            disconnectReason: reason,
            updatedAt: new Date()
          }
        }
      );
    } catch (error) {
      this.emit('error', error);
    }
  }
  
  /**
   * Guarda un evento
   * @param {Object} event - Datos del evento
   */
  async saveEvent(event) {
    if (!this.connected) return;
    
    try {
      await this.collectionsCache.events.insertOne({
        ...event,
        timestamp: new Date()
      });
    } catch (error) {
      this.emit('error', error);
    }
  }
  
  /**
   * Guarda un log
   * @param {Object} log - Datos del log
   */
  async saveLog(log) {
    if (!this.connected) return;
    
    try {
      await this.collectionsCache.logs.insertOne({
        ...log,
        timestamp: new Date()
      });
    } catch (error) {
      this.emit('error', error);
    }
  }
  
  /**
   * Obtiene mensajes de un usuario
   * @param {string} usuario - ID del usuario
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<Array>}
   */
  async getMessagesByUser(usuario, options = {}) {
    if (!this.connected) return [];
    
    try {
      const query = { usuario };
      const limit = options.limit || 100;
      const skip = options.skip || 0;
      
      return await this.collectionsCache.messages
        .find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip)
        .toArray();
    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }
  
  /**
   * Obtiene conexiones activas
   * @returns {Promise<Array>}
   */
  async getActiveConnections() {
    if (!this.connected) return [];
    
    try {
      return await this.collectionsCache.connections
        .find({ disconnectedAt: { $exists: false } })
        .toArray();
    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }
  
  /**
   * Desconecta de MongoDB
   */
  async disconnect() {
    if (!this.connected) return;
    
    try {
      await this.client.close();
      this.connected = false;
      this.emit('disconnected');
    } catch (error) {
      this.emit('error', error);
    }
  }
  
  /**
   * Verifica si está conectado
   * @returns {boolean}
   */
  isConnected() {
    return this.connected && this.client?.topology?.isConnected();
  }
}

