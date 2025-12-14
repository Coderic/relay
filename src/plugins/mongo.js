/**
 * Plugin de persistencia MongoDB para Relay
 * Plugin opcional que proporciona almacenamiento de mensajes, conexiones, eventos y logs
 */

import { RelayPlugin } from './index.js';
import { RelayMongo } from '../mongo.js';

/**
 * Plugin de MongoDB para Relay
 */
export class MongoPlugin extends RelayPlugin {
  constructor(options = {}) {
    super('mongo', options);
    this.mongoClient = null;
  }
  
  /**
   * Inicializa el plugin MongoDB
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.options.url) {
      throw new Error('MongoDB URL is required');
    }
    
    try {
      this.mongoClient = new RelayMongo({
        url: this.options.url,
        dbName: this.options.dbName || 'relay',
        collections: this.options.collections
      });
      
      // Escuchar eventos de MongoDB
      this.mongoClient.on('connected', () => {
        this.emit('connected');
      });
      
      this.mongoClient.on('error', (error) => {
        this.emit('error', error);
      });
      
      await this.mongoClient.connect();
      await super.initialize();
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Desactiva el plugin
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.mongoClient) {
      await this.mongoClient.disconnect();
      this.mongoClient = null;
    }
    await super.shutdown();
  }
  
  /**
   * Guarda un mensaje
   * @param {Object} message - Datos del mensaje
   */
  async saveMessage(message) {
    if (this.mongoClient) {
      await this.mongoClient.saveMessage(message);
    }
  }
  
  /**
   * Guarda o actualiza una conexión
   * @param {Object} connection - Datos de la conexión
   */
  async saveConnection(connection) {
    if (this.mongoClient) {
      await this.mongoClient.saveConnection(connection);
    }
  }
  
  /**
   * Actualiza el estado de desconexión
   * @param {string} socketId - ID del socket
   * @param {string} reason - Razón de desconexión
   */
  async updateConnectionDisconnect(socketId, reason) {
    if (this.mongoClient) {
      await this.mongoClient.updateConnectionDisconnect(socketId, reason);
    }
  }
  
  /**
   * Guarda un evento
   * @param {Object} event - Datos del evento
   */
  async saveEvent(event) {
    if (this.mongoClient) {
      await this.mongoClient.saveEvent(event);
    }
  }
  
  /**
   * Guarda un log
   * @param {Object} log - Datos del log
   */
  async saveLog(log) {
    if (this.mongoClient) {
      await this.mongoClient.saveLog(log);
    }
  }
  
  /**
   * Obtiene el cliente MongoDB
   * @returns {RelayMongo|null}
   */
  getClient() {
    return this.mongoClient;
  }
  
  /**
   * Verifica si está conectado
   * @returns {boolean}
   */
  isConnected() {
    return this.mongoClient?.isConnected() || false;
  }
}

