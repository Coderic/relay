# Plugin WebRTC

Plugin opcional de WebRTC para Relay que proporciona señalización para video, audio y compartir pantalla en tiempo real.

## Características

- ✅ Video chat P2P (peer-to-peer)
- ✅ Audio en tiempo real
- ✅ Compartir pantalla
- ✅ Controles de audio/video
- ✅ Múltiples participantes (mesh topology)
- ✅ Detección de desconexión
- ✅ Soporte STUN/TURN
- ✅ Usa la API estándar de Relay (no eventos propios)

## Activación

El plugin WebRTC está activado por defecto. Para desactivarlo:

**Opción 1: Variable de entorno (recomendado para Docker)**
```bash
WEBRTC_ENABLED=false
```

**Opción 2: Configuración programática**

```javascript
const gateway = createRelay({
  plugins: {
    webrtc: false
  }
});
```

## Configuración de STUN/TURN Servers

El plugin WebRTC puede configurarse para usar servidores STUN y TURN personalizados. Por defecto, usa servidores STUN públicos de Google.

### Variables de Entorno

#### STUN Servers

```bash
# Lista de servidores STUN separados por comas
STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302

# O como array JSON
STUN_SERVERS=["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]
```

#### TURN Server

```bash
# URL del servidor TURN (requerido para habilitar TURN)
TURN_URL=turn:turn.tudominio.com:3478

# Credenciales (opcional, dependiendo de la configuración de coturn)
TURN_USERNAME=usuario
TURN_CREDENTIAL=password
```

### Configuración Programática

#### Solo STUN personalizado

```javascript
const gateway = createRelay({
  plugins: {
    webrtc: {
      stun: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  }
});
```

#### STUN + TURN

```javascript
const gateway = createRelay({
  plugins: {
    webrtc: {
      stun: [
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      turn: {
        url: 'turn:turn.tudominio.com:3478',
        username: 'usuario',      // Opcional
        credential: 'password'    // Opcional
      }
    }
  }
});
```

#### Configuración Completa Personalizada

Si necesitas control total sobre los servidores ICE:

```javascript
const gateway = createRelay({
  plugins: {
    webrtc: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:turn.tudominio.com:3478',
          username: 'usuario',
          credential: 'password'
        }
      ]
    }
  }
});
```

**Nota**: Si proporcionas `iceServers`, se ignoran las opciones `stun` y `turn`.

### Obtención Automática de Configuración

Los clientes WebRTC obtienen automáticamente la configuración de ICE servers del servidor. No necesitas configurarlos manualmente en el cliente:

```javascript
// El cliente obtiene automáticamente la configuración del servidor
const webrtc = new WebRTCManager(socket);
// Los ICE servers se obtienen del servidor automáticamente
```

Si necesitas usar una configuración personalizada en el cliente (por ejemplo, para desarrollo local):

```javascript
const webrtc = new WebRTCManager(socket, {
  useServerConfig: false,  // No usar configuración del servidor
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
});
```

## Uso en el Frontend

### Instalación

```javascript
import { WebRTCManager } from '@coderic/relay';
// o desde el CDN
// <script type="module">
//   import { WebRTCManager } from 'https://cdn.jsdelivr.net/npm/@coderic/relay/webrtc-client.js';
// </script>
```

### Ejemplo Básico

```javascript
import io from 'socket.io-client';
import { WebRTCManager } from '@coderic/relay';

// Conectar a Relay
const socket = io('http://localhost:5000/relay');

// Identificarse
await new Promise((resolve) => {
  socket.emit('identificar', 'usuario-123', resolve);
});

// Crear manager WebRTC
const webrtc = new WebRTCManager(socket, {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
});

// Callbacks
webrtc.onRemoteStream = (peerId, stream) => {
  // Mostrar video remoto
  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  document.body.appendChild(video);
};

webrtc.onPeerDisconnected = (peerId) => {
  console.log('Peer desconectado:', peerId);
  // Remover video del peer
};

webrtc.onConnectionStateChange = (peerId, state) => {
  console.log(`Peer ${peerId}: ${state}`);
};

// Obtener video/audio del usuario
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});

// Configurar stream local
await webrtc.setLocalStream(stream);

// Unirse a un room
await webrtc.joinRoom('mi-sala-video');
```

### API Completa

#### Constructor

```javascript
const webrtc = new WebRTCManager(socket, config);
```

**Parámetros:**
- `socket`: Socket.io socket conectado a Relay
- `config`: Configuración opcional
  - `iceServers`: Array de servidores STUN/TURN

#### Métodos

##### `setLocalStream(stream)`
Configura el stream local de video/audio.

```javascript
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});
await webrtc.setLocalStream(stream);
```

##### `joinRoom(roomId, peerId?)`
Se une a un room de WebRTC.

```javascript
await webrtc.joinRoom('mi-sala');
```

##### `leaveRoom()`
Sale del room y cierra todas las conexiones.

```javascript
webrtc.leaveRoom();
```

##### `toggleAudio(enabled)`
Activa/desactiva el audio.

```javascript
webrtc.toggleAudio(false); // Silenciar
webrtc.toggleAudio(true);  // Activar
```

##### `toggleVideo(enabled)`
Activa/desactiva el video.

```javascript
webrtc.toggleVideo(false); // Apagar cámara
webrtc.toggleVideo(true);  // Encender cámara
```

##### `destroy()`
Destruye el manager y cierra todas las conexiones.

```javascript
webrtc.destroy();
```

#### Callbacks

##### `onRemoteStream(peerId, stream)`
Se llama cuando se recibe un stream remoto.

```javascript
webrtc.onRemoteStream = (peerId, stream) => {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  document.body.appendChild(video);
};
```

##### `onPeerDisconnected(peerId)`
Se llama cuando un peer se desconecta.

```javascript
webrtc.onPeerDisconnected = (peerId) => {
  console.log('Peer desconectado:', peerId);
  // Limpiar UI del peer
};
```

##### `onConnectionStateChange(peerId, state)`
Se llama cuando cambia el estado de conexión.

```javascript
webrtc.onConnectionStateChange = (peerId, state) => {
  console.log(`Peer ${peerId}: ${state}`);
  // Estados: 'connecting', 'connected', 'disconnected', 'failed'
};
```

## Compartir Pantalla

```javascript
// Obtener stream de pantalla
const screenStream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: true
});

// Reemplazar stream local
await webrtc.setLocalStream(screenStream);
```

## Configuración STUN/TURN

### Desarrollo (Solo STUN)

```javascript
const webrtc = new WebRTCManager(socket, {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
});
```

### Producción (STUN + TURN)

```javascript
const webrtc = new WebRTCManager(socket, {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turn.tudominio.com:3478',
      username: 'usuario',
      credential: 'password'
    }
  ]
});
```

## Cómo Funciona

El plugin WebRTC usa la API estándar de Relay:

1. **Unirse al room**: Usa `unirse` de Relay
2. **Señalización**: Usa `relay` con `destino: 'room'` y tipos `webrtc:*`
3. **Tipos de mensaje**:
   - `webrtc:join` - Unirse a un room
   - `webrtc:offer` - Oferta WebRTC
   - `webrtc:answer` - Respuesta WebRTC
   - `webrtc:ice-candidate` - Candidato ICE
   - `webrtc:leave` - Salir del room

**Ejemplo de mensaje interno:**
```javascript
socket.emit('relay', {
  destino: 'room',
  room: 'mi-sala',
  tipo: 'webrtc:offer',
  to: 'peer-id',
  offer: rtcOffer
});
```

## Límites y Consideraciones

- **Topología Mesh**: Cada peer se conecta directamente con todos los demás
- **Escalabilidad**: Recomendado hasta 6 participantes simultáneos
- **NAT/Firewall**: Requiere TURN server para NAT simétrico
- **HTTPS**: Requerido en producción para `getUserMedia`

## Ejemplo Completo

Ver el ejemplo funcional en `public/examples/video-chat.html` o consultar la [documentación completa de WebRTC](/docs/plugins-webrtc).

## Troubleshooting

### Conexión no se establece
- Verificar que STUN está configurado
- Para NAT simétrico, necesitas TURN server
- Revisar console.log del navegador

### Video no aparece
- Verificar permisos de cámara/micrófono
- Usar HTTPS en producción
- Verificar que `setLocalStream()` fue llamado

### Plugin no se activa
- Verificar logs: `[Relay] WebRTC plugin activado`
- Verificar que no está desactivado: `plugins: { webrtc: false }`

## Recursos

- [WebRTC API MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Instalación Coturn](https://github.com/coturn/coturn)
- [STUN/TURN Servers](https://webrtc.org/getting-started/turn-server)

