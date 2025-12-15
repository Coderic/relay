/**
 * Cliente WebRTC para Relay
 * Maneja la señalización WebRTC usando la API de Relay (relay con destino room)
 * 
 * @example
 * const socket = io('http://localhost:5000/relay');
 * const webrtc = new WebRTCManager(socket);
 * 
 * webrtc.onRemoteStream = (peerId, stream) => {
 *   videoElement.srcObject = stream;
 * };
 * 
 * const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
 * await webrtc.setLocalStream(stream);
 * await webrtc.joinRoom('mi-sala');
 */

export class WebRTCManager {
  /**
   * @param {Socket} socket - Socket.io socket conectado a Relay
   * @param {Object} config - Configuración WebRTC
   * @param {Array} config.iceServers - Servidores STUN/TURN
   */
  constructor(socket, config = {}) {
    this.socket = socket;
    this.config = {
      iceServers: config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      ...config
    };
    this.peers = new Map(); // peerId -> RTCPeerConnection
    this.localStream = null;
    this.roomId = null;
    this.peerId = null;
    
    this.setupSocketHandlers();
  }

  /**
   * Configura los handlers de Socket.io
   * Escucha mensajes de tipo webrtc:* en el evento relay
   * @private
   */
  setupSocketHandlers() {
    this.socket.on('relay', (data) => {
      if (!data.tipo || !data.tipo.startsWith('webrtc:')) return;

      switch (data.tipo) {
        case 'webrtc:joined':
          this.handleJoined(data);
          break;
        case 'webrtc:peer-joined':
          this.handlePeerJoined(data);
          break;
        case 'webrtc:offer':
          this.handleOffer(data);
          break;
        case 'webrtc:answer':
          this.handleAnswer(data);
          break;
        case 'webrtc:ice-candidate':
          this.handleIceCandidate(data);
          break;
        case 'webrtc:peer-left':
          this.handlePeerLeft(data);
          break;
      }
    });
  }

  /**
   * Maneja la confirmación de unión al room
   * @param {Object} data - Datos del mensaje
   */
  handleJoined(data) {
    const { roomId, peers } = data;
    this.roomId = roomId;
    
    // Crear conexiones con peers existentes
    peers.forEach(peerId => {
      this.createPeerConnection(peerId, true);
    });
  }

  /**
   * Maneja cuando un nuevo peer se une
   * @param {Object} data - Datos del mensaje
   */
  handlePeerJoined(data) {
    const { peerId, socketId } = data;
    // Solo crear conexión si no existe y si es para nosotros
    if (!this.peers.has(socketId)) {
      this.createPeerConnection(socketId, false);
    }
  }

  /**
   * Maneja una oferta WebRTC
   * @param {Object} data - Datos del mensaje
   */
  async handleOffer(data) {
    const { from, to, offer } = data;
    
    // Solo procesar si es para nosotros
    if (to !== this.socket.id && to !== this.peerId) return;
    
    let pc = this.peers.get(from);
    if (!pc) {
      pc = this.createPeerConnection(from, false);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Enviar respuesta usando la API de Relay
    this.socket.emit('relay', {
      destino: 'room',
      room: this.roomId,
      tipo: 'webrtc:answer',
      to: from,
      answer: pc.localDescription
    });
  }

  /**
   * Maneja una respuesta WebRTC
   * @param {Object} data - Datos del mensaje
   */
  async handleAnswer(data) {
    const { from, to, answer } = data;
    
    // Solo procesar si es para nosotros
    if (to !== this.socket.id && to !== this.peerId) return;
    
    const pc = this.peers.get(from);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  /**
   * Maneja un candidato ICE
   * @param {Object} data - Datos del mensaje
   */
  async handleIceCandidate(data) {
    const { from, to, candidate } = data;
    
    // Solo procesar si es para nosotros
    if (to !== this.socket.id && to !== this.peerId) return;
    
    const pc = this.peers.get(from);
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  /**
   * Maneja cuando un peer se desconecta
   * @param {Object} data - Datos del mensaje
   */
  handlePeerLeft(data) {
    const { peerId, socketId } = data;
    this.closePeerConnection(socketId || peerId);
  }

  /**
   * Crea una conexión peer-to-peer
   * @param {string} peerId - ID del peer (socketId)
   * @param {boolean} createOffer - Si debe crear la oferta
   * @returns {RTCPeerConnection}
   */
  createPeerConnection(peerId, createOffer) {
    const pc = new RTCPeerConnection(this.config);

    // Agregar tracks locales si existen
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Manejar candidatos ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('relay', {
          destino: 'room',
          room: this.roomId,
          tipo: 'webrtc:ice-candidate',
          to: peerId,
          candidate: event.candidate
        });
      }
    };

    // Manejar streams remotos
    pc.ontrack = (event) => {
      if (this.onRemoteStream) {
        this.onRemoteStream(peerId, event.streams[0]);
      }
    };

    // Manejar cambios de estado
    pc.onconnectionstatechange = () => {
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(peerId, pc.connectionState);
      }
      
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.closePeerConnection(peerId);
      }
    };

    this.peers.set(peerId, pc);

    if (createOffer) {
      this.createOffer(peerId);
    }

    return pc;
  }

  /**
   * Crea una oferta WebRTC
   * @param {string} peerId - ID del peer
   */
  async createOffer(peerId) {
    const pc = this.peers.get(peerId);
    if (!pc) return;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Enviar oferta usando la API de Relay
    this.socket.emit('relay', {
      destino: 'room',
      room: this.roomId,
      tipo: 'webrtc:offer',
      to: peerId,
      offer: pc.localDescription
    });
  }

  /**
   * Configura el stream local
   * @param {MediaStream} stream - Stream de video/audio
   */
  async setLocalStream(stream) {
    this.localStream = stream;

    // Agregar tracks a todas las conexiones existentes
    this.peers.forEach((pc, peerId) => {
      stream.getTracks().forEach(track => {
        const sender = pc.getSenders().find(s => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          pc.addTrack(track, stream);
        }
      });
    });
  }

  /**
   * Se une a un room de WebRTC
   * @param {string} roomId - ID del room
   * @param {string} peerId - ID del peer (opcional, usa socket.id por defecto)
   */
  async joinRoom(roomId, peerId = null) {
    this.peerId = peerId || this.socket.id;
    
    // Primero unirse al room usando la API de Relay
    this.socket.emit('unirse', roomId, (ok) => {
      if (ok) {
        // Luego enviar mensaje de unión WebRTC usando la API de Relay
        this.socket.emit('relay', {
          destino: 'room',
          room: roomId,
          tipo: 'webrtc:join',
          roomId,
          peerId: this.peerId
        });
      }
    });
  }

  /**
   * Sale del room
   */
  leaveRoom() {
    if (this.roomId) {
      this.socket.emit('relay', {
        destino: 'room',
        room: this.roomId,
        tipo: 'webrtc:leave'
      });
    }
    
    this.peers.forEach((pc, peerId) => {
      this.closePeerConnection(peerId);
    });
    
    this.roomId = null;
  }

  /**
   * Cierra una conexión peer
   * @param {string} peerId - ID del peer
   */
  closePeerConnection(peerId) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
      if (this.onPeerDisconnected) {
        this.onPeerDisconnected(peerId);
      }
    }
  }

  /**
   * Activa/desactiva audio
   * @param {boolean} enabled - Si el audio está habilitado
   */
  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Activa/desactiva video
   * @param {boolean} enabled - Si el video está habilitado
   */
  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Destruye el manager y cierra todas las conexiones
   */
  destroy() {
    this.leaveRoom();
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }
}

