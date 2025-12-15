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
    namespace.on('connection', (socket) => {
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
    this.peers.set(socket.id, { roomId, peerId: peerId || socket.id });

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
      peerId: peerId || socket.id,
      socketId: socket.id
    });

    this.emit('peer:joined', { socketId: socket.id, roomId, peerId: peerId || socket.id });
  }

  /**
   * Maneja una oferta WebRTC
   * @param {Socket} socket - Socket del emisor
   * @param {Object} data - Datos del mensaje relay
   */
  handleOffer(socket, data) {
    const { to, offer } = data;
    if (!to || !offer) return;

    // Reenviar usando la API de Relay (destino: 'yo' para el destinatario específico)
    // Nota: Relay no tiene destino directo a un socket específico,
    // pero podemos usar el room y filtrar en el cliente, o usar 'yo' con el socketId
    // Por ahora, usamos el room y el cliente filtra por socketId
    const peerInfo = this.peers.get(socket.id);
    if (!peerInfo) return;

    // Enviar al room, el cliente filtrará por socketId
    socket.to(peerInfo.roomId).emit('relay', {
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

    const peerInfo = this.peers.get(socket.id);
    if (!peerInfo) return;

    socket.to(peerInfo.roomId).emit('relay', {
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

    const peerInfo = this.peers.get(socket.id);
    if (!peerInfo) return;

    socket.to(peerInfo.roomId).emit('relay', {
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

    const { roomId } = peerInfo;
    const room = this.rooms.get(roomId);

    if (room) {
      room.delete(socket.id);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    this.peers.delete(socket.id);
    
    // Notificar a otros en el room
    socket.to(roomId).emit('relay', {
      tipo: 'webrtc:peer-left',
      peerId: socket.id,
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
    await super.shutdown();
  }
}

