/**
 * Plugin WebRTC para Relay
 * Proporciona señalización WebRTC usando la API de Relay (relay con destino room)
 * 
 * Este plugin NO modifica la API de Relay, solo escucha mensajes con tipo 'webrtc:*'
 * y los reenvía usando la infraestructura de rooms de Relay.
 */

import { RelayPlugin } from './index.js';

/**
 * Plugin WebRTC para Relay
 * Maneja la señalización WebRTC usando la API estándar de Relay
 */
export class WebRTCPlugin extends RelayPlugin {
  constructor(options = {}) {
    super('webrtc', options);
    this.rooms = new Map(); // roomId -> Set de socketIds
    this.peers = new Map(); // socketId -> { roomId, peerId }
    this.peerIdToSocketId = new Map(); // peerId -> socketId (mapa inverso)
    this.namespace = null; // Guardar referencia al namespace
    
    // Configuración de ICE servers (STUN/TURN)
    this.iceServers = this.buildIceServers(options);
  }

  /**
   * Construye la configuración de ICE servers desde las opciones
   * @param {Object} options - Opciones del plugin
   * @returns {Array} Array de servidores ICE
   */
  buildIceServers(options) {
    // Si se proporcionan iceServers personalizados, usarlos directamente
    if (options.iceServers && Array.isArray(options.iceServers)) {
      return options.iceServers;
    }
    
    const iceServers = [];
    
    // STUN servers por defecto (configurables)
    const defaultStunServers = options.stun || [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];
    
    // Agregar servidores STUN
    if (Array.isArray(defaultStunServers)) {
      defaultStunServers.forEach(server => {
        if (typeof server === 'string') {
          // Si es un string, convertirlo a objeto
          iceServers.push({ urls: server });
        } else if (server && server.urls) {
          // Si es un objeto, agregarlo directamente
          iceServers.push(server);
        }
      });
    }
    
    // TURN server si está configurado
    if (options.turn) {
      const turnConfig = {
        urls: options.turn.url || options.turn.urls
      };
      
      if (options.turn.username) {
        turnConfig.username = options.turn.username;
      }
      
      if (options.turn.credential) {
        turnConfig.credential = options.turn.credential;
      }
      
      if (turnConfig.urls) {
        iceServers.push(turnConfig);
      }
    }
    
    return iceServers;
  }

  /**
   * Obtiene la configuración de ICE servers
   * @returns {Array} Array de servidores ICE
   */
  getIceServers() {
    return this.iceServers;
  }

  /**
   * Inicializa el plugin
   * @returns {Promise<void>}
   */
  async initialize() {
    await super.initialize();
    this.emit('initialized');
  }

  /**
   * Configura los handlers para el namespace
   * Este método se llama desde Relay después de _setupSocketIO()
   * @param {Namespace} namespace - Namespace de Socket.io
   */
  setupHandlers(namespace) {
    this.namespace = namespace; // Guardar referencia al namespace
    
    namespace.on('connection', (socket) => {
      // Endpoint para obtener configuración de ICE servers
      socket.on('webrtc:get-ice-servers', (callback) => {
        if (typeof callback === 'function') {
          callback({ iceServers: this.getIceServers() });
        }
      });
      
      // Escuchar mensajes de tipo webrtc:* en el evento relay
      socket.on('relay', (data) => {
        if (!data.tipo || !data.tipo.startsWith('webrtc:')) return;
        
        switch (data.tipo) {
          case 'webrtc:join':
            this.handleJoinRoom(socket, data);
            break;
          case 'webrtc:offer':
            this.handleOffer(socket, data);
            break;
          case 'webrtc:answer':
            this.handleAnswer(socket, data);
            break;
          case 'webrtc:ice-candidate':
            this.handleIceCandidate(socket, data);
            break;
          case 'webrtc:leave':
            this.handleLeaveRoom(socket);
            break;
        }
      });

      // Limpiar al desconectar
      socket.on('disconnect', () => {
        this.handleLeaveRoom(socket);
      });
    });
  }

  /**
   * Maneja la unión a un room de WebRTC
   * @param {Socket} socket - Socket del cliente
   * @param {Object} data - Datos del mensaje relay
   */
  handleJoinRoom(socket, data) {
    const { roomId, peerId } = data;
    if (!roomId) return;

    const actualPeerId = peerId || socket.id;

    // Inicializar room si no existe
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }

    const room = this.rooms.get(roomId);
    const existingPeers = Array.from(room).map(socketId => {
      const peerInfo = this.peers.get(socketId);
      return peerInfo?.peerId || socketId;
    });

    // Agregar socket al room
    room.add(socket.id);
    this.peers.set(socket.id, { roomId, peerId: actualPeerId });
    this.peerIdToSocketId.set(actualPeerId, socket.id); // Mapa inverso

    // Unirse al room de Socket.io (para usar la infraestructura de Relay)
    socket.join(roomId);

    // Notificar al cliente que se unió
    socket.emit('relay', {
      tipo: 'webrtc:joined',
      roomId,
      peers: existingPeers
    });

    // Notificar a otros en el room
    socket.to(roomId).emit('relay', {
      tipo: 'webrtc:peer-joined',
      peerId: actualPeerId,
      socketId: socket.id
    });

    this.emit('peer:joined', { socketId: socket.id, roomId, peerId: actualPeerId });
  }

  /**
   * Maneja una oferta WebRTC
   * @param {Socket} socket - Socket del emisor
   * @param {Object} data - Datos del mensaje relay
   */
  handleOffer(socket, data) {
    const { to, offer } = data;
    if (!to || !offer) return;

    // Buscar socketId del destinatario usando el mapa inverso
    const targetSocketId = this.peerIdToSocketId.get(to);
    if (!targetSocketId) {
      console.warn(`[WebRTCPlugin] No se encontró socketId para peerId: ${to}`);
      return;
    }

    // Enviar directamente al socket del destinatario
    this.namespace.to(targetSocketId).emit('relay', {
      tipo: 'webrtc:offer',
      from: socket.id,
      to,
      offer
    });
  }

  /**
   * Maneja una respuesta WebRTC
   * @param {Socket} socket - Socket del emisor
   * @param {Object} data - Datos del mensaje relay
   */
  handleAnswer(socket, data) {
    const { to, answer } = data;
    if (!to || !answer) return;

    const targetSocketId = this.peerIdToSocketId.get(to);
    if (!targetSocketId) {
      console.warn(`[WebRTCPlugin] No se encontró socketId para peerId: ${to}`);
      return;
    }

    // Enviar directamente al socket del destinatario
    this.namespace.to(targetSocketId).emit('relay', {
      tipo: 'webrtc:answer',
      from: socket.id,
      to,
      answer
    });
  }

  /**
   * Maneja un candidato ICE
   * @param {Socket} socket - Socket del emisor
   * @param {Object} data - Datos del mensaje relay
   */
  handleIceCandidate(socket, data) {
    const { to, candidate } = data;
    if (!to || !candidate) return;

    const targetSocketId = this.peerIdToSocketId.get(to);
    if (!targetSocketId) {
      console.warn(`[WebRTCPlugin] No se encontró socketId para peerId: ${to}`);
      return;
    }

    // Enviar directamente al socket del destinatario
    this.namespace.to(targetSocketId).emit('relay', {
      tipo: 'webrtc:ice-candidate',
      from: socket.id,
      to,
      candidate
    });
  }

  /**
   * Maneja la salida de un room
   * @param {Socket} socket - Socket del cliente
   */
  handleLeaveRoom(socket) {
    const peerInfo = this.peers.get(socket.id);
    if (!peerInfo) return;

    const { roomId, peerId } = peerInfo;
    const room = this.rooms.get(roomId);

    if (room) {
      room.delete(socket.id);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    // Limpiar mapas
    this.peers.delete(socket.id);
    this.peerIdToSocketId.delete(peerId);

    // Notificar a otros en el room
    socket.to(roomId).emit('relay', {
      tipo: 'webrtc:peer-left',
      peerId: peerId,
      socketId: socket.id
    });

    socket.leave(roomId);
    this.emit('peer:left', { socketId: socket.id, roomId });
  }

  /**
   * Obtiene los peers de un room
   * @param {string} roomId - ID del room
   * @returns {Array<string>} Lista de socketIds
   */
  getRoomPeers(roomId) {
    return Array.from(this.rooms.get(roomId) || []);
  }

  /**
   * Cierra el plugin
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.rooms.clear();
    this.peers.clear();
    this.peerIdToSocketId.clear();
    this.namespace = null;
    await super.shutdown();
  }
}

