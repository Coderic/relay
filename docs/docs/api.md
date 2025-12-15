# API Reference

## Cliente Navegador

### RelayConector

Clase helper para facilitar el uso de Relay en el navegador.

```javascript
const relay = new RelayConector('http://demo.relay.coderic.net');
```

#### Métodos

##### `conectar()`

Conecta al servidor Relay.

```javascript
await relay.conectar();
```

##### `identificar(userId)`

Identifica al usuario con un ID.

```javascript
await relay.identificar('mi-usuario-123');
```

##### `enviarAMi(data)`

Envía un mensaje solo al emisor.

```javascript
relay.enviarAMi({ tipo: 'confirmacion', mensaje: 'OK' });
```

##### `enviarAOtros(data)`

Envía un mensaje a todos excepto al emisor.

```javascript
relay.enviarAOtros({ tipo: 'nuevo_usuario', nombre: 'Juan' });
```

##### `enviarATodos(data)`

Envía un mensaje a todos incluyendo al emisor.

```javascript
relay.enviarATodos({ tipo: 'mensaje', texto: 'Hola a todos!' });
```

##### `on(evento, callback)`

Escucha eventos.

```javascript
relay.on('relay', (data) => {
  console.log('Mensaje recibido:', data);
});

relay.on('notificar', (data) => {
  console.log('Notificación:', data);
});
```

## Socket.io Directo

Si prefieres usar Socket.io directamente:

```javascript
const socket = io('http://demo.relay.coderic.net/relay');

// Identificar
socket.emit('identificar', 'mi-usuario', (ok) => {
  console.log('Identificado:', ok);
});

// Enviar mensaje
socket.emit('relay', { 
  destino: 'nosotros',
  tipo: 'saludo',
  mensaje: 'Hola!' 
});

// Recibir mensajes
socket.on('relay', (data) => {
  console.log('Mensaje:', data);
});
```

## Cliente Node.js

### RelayClient

```javascript
import { RelayClient } from '@coderic/relay';

const client = new RelayClient('http://demo.relay.coderic.net');
await client.connect();

// Identificarse
await client.identificar('usuario123');

// Enviar mensajes
client.enviar({ texto: 'Hola mundo!' }, 'nosotros');

// Escuchar mensajes
client.on('mensaje', (data) => {
  console.log('Recibido:', data);
});
```

## Eventos del Cliente

### Eventos que puedes emitir

| Evento | Descripción | Payload |
|--------|-------------|---------|
| `identificar` | Identificar usuario | `(userId, callback)` |
| `notificar` | Enviar notificación | `{ ...data, destino }` |
| `relay` | Canal genérico | `{ ...data, destino }` |

### Eventos que puedes escuchar

| Evento | Descripción | Payload |
|--------|-------------|---------|
| `relay` | Mensaje recibido | `{ ...data, origen }` |
| `notificar` | Notificación recibida | `{ ...data, origen }` |
| `connect` | Conectado al servidor | - |
| `disconnect` | Desconectado | - |

## Destinos

| Destino | Descripción |
|---------|-------------|
| `yo` | Solo al emisor (default) |
| `ustedes` | A todos menos el emisor |
| `nosotros` | A todos incluyendo el emisor |

## Servidor

### createRelay(options)

Crea una instancia del gateway.

```javascript
import { createRelay } from '@coderic/relay';

const gateway = createRelay({
  port: 5000,
  redis: { url: 'redis://localhost:6379' },
  kafka: { brokers: ['localhost:9092'] }
});

await gateway.start();
```

### Eventos del servidor

```javascript
gateway.on('ready', ({ port }) => {
  console.log(`Servidor en puerto ${port}`);
});

gateway.on('connection', (socket) => {
  console.log('Nueva conexión:', socket.id);
});

gateway.on('disconnect', ({ socket, reason }) => {
  console.log('Desconexión:', socket.id, reason);
});

gateway.on('user:identified', ({ usuario, socketId }) => {
  console.log('Usuario identificado:', usuario);
});

gateway.on('message', ({ socket, data }) => {
  console.log('Mensaje de', socket.data.usuario, ':', data);
});

gateway.on('notify', ({ socket, data }) => {
  console.log('Notificación:', data);
});

gateway.on('redis:connected', () => {
  console.log('Redis conectado');
});

gateway.on('kafka:connected', () => {
  console.log('Kafka conectado');
});
```

## Endpoints HTTP

| Endpoint | Descripción | Respuesta |
|----------|-------------|-----------|
| `/health` | Health check | JSON con estado |
| `/metrics` | Métricas Prometheus | Texto plano |

### Ejemplo de `/health`

```json
{
  "status": "ok",
  "uptime": 3600,
  "connections": 42,
  "instance": "gateway-1"
}
```

## Estructura de Mensajes

### Formato estándar

```javascript
{
  destino: 'nosotros',  // 'yo' | 'ustedes' | 'nosotros'
  tipo: 'mensaje',      // Tu tipo personalizado
  // ... tus datos personalizados
}
```

### Ejemplo completo

```javascript
// Enviar
relay.enviarATodos({
  tipo: 'pedido',
  pedidoId: 'ABC123',
  estado: 'preparando',
  timestamp: Date.now()
});

// Recibir
relay.on('relay', (data) => {
  if (data.tipo === 'pedido') {
    console.log('Pedido:', data.pedidoId, data.estado);
  }
});
```

