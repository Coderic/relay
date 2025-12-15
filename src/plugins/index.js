/**
 * Sistema de plugins para Relay
 * Permite extender funcionalidad de forma opcional
 */

import EventEmitter from 'events';

/**
 * Clase base para plugins de Relay
 */
export class RelayPlugin extends EventEmitter {
  /**
   * @param {string} name - Nombre del plugin
   * @param {Object} options - Opciones del plugin
   */
  constructor(name, options = {}) {
    super();
    this.name = name;
    this.options = options;
    this.enabled = false;
  }
  
  /**
   * Inicializa el plugin
   * @returns {Promise<void>}
   */
  async initialize() {
    this.enabled = true;
    this.emit('initialized');
  }
  
  /**
   * Desactiva el plugin
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.enabled = false;
    this.emit('shutdown');
  }
  
  /**
   * Verifica si el plugin está habilitado
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
}

/**
 * Registro de plugins disponibles
 */
export const plugins = {
  mongo: null,
  webrtc: null
};

/**
 * Registra un plugin
 * @param {string} name - Nombre del plugin
 * @param {RelayPlugin} plugin - Instancia del plugin
 */
export function registerPlugin(name, plugin) {
  plugins[name] = plugin;
}

/**
 * Obtiene un plugin registrado
 * @param {string} name - Nombre del plugin
 * @returns {RelayPlugin|null}
 */
export function getPlugin(name) {
  return plugins[name] || null;
}

