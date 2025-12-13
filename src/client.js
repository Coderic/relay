/**
 * Cliente Pasarela para Node.js
 * 
 * @example
 * import { PasarelaClient } from 'pasarela-gateway';
 * 
 * const client = new PasarelaClient('http://localhost:5000');
 * await client.connect();
 * 
 * client.identificar('usuario123');
 * client.enviar({ mensaje: 'Hola!' }, 'nosotros');
 */

import { io } from 'socket.io-client';
import EventEmitter from 'events';

/**
 * Cliente para conectarse a un servidor Pasarela
 */
export class PasarelaClient extends EventEmitter {
  /**
   * @param {string} url - URL del servidor Pasarela
   * @param {Object} options - Opciones de Socket.io
   */
  constructor(url, options = {}) {
    super();
    
    this.url = url.endsWith('/pasarela') ? url : `${url}/pasarela`;
    this.options = {
      transports: ['websocket', 'polling'],
      ...options
    };
    this.socket = null;
    this.usuario = null;
    this.connected = false;
  }
  
  /**
   * Conecta al servidor Pasarela
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(this.url, this.options);
      
      this.socket.on('connect', () => {
        this.connected = true;
        this.emit('connected', { id: this.socket.id });
        resolve();
      });
      
      this.socket.on('connect_error', (error) => {
        this.emit('error', error);
        reject(error);
      });
      
      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        this.emit('disconnected', { reason });
      });
      
      // Eventos de Pasarela
      this.socket.on('notificar', (data) => {
        this.emit('notificar', data);
      });
      
      this.socket.on('pasarela', (data) => {
        this.emit('pasarela', data);
        this.emit('mensaje', data);
      });
    });
  }
  
  /**
   * Identifica al usuario en el servidor
   * @param {string} usuario - Identificador del usuario
   * @returns {Promise<boolean>}
   */
  identificar(usuario) {
    return new Promise((resolve) => {
      this.socket.emit('identificar', usuario, (success) => {
        if (success) {
          this.usuario = usuario;
        }
        this.emit('identificado', { usuario, success });
        resolve(success);
      });
    });
  }
  
  /**
   * Envía un mensaje a través del canal pasarela
   * @param {Object} data - Datos a enviar
   * @param {string} [destino='yo'] - Destino: 'yo', 'ustedes', 'nosotros'
   */
  enviar(data, destino = 'yo') {
    this.socket.emit('pasarela', { ...data, destino });
  }
  
  /**
   * Envía una notificación
   * @param {Object} data - Datos de la notificación
   * @param {string} [destino='yo'] - Destino: 'yo', 'ustedes', 'nosotros'
   */
  notificar(data, destino = 'yo') {
    this.socket.emit('notificar', { ...data, destino });
  }
  
  /**
   * Desconecta del servidor
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }
  
  /**
   * Obtiene el socket raw para uso avanzado
   * @returns {Socket}
   */
  getSocket() {
    return this.socket;
  }
}

export default PasarelaClient;

