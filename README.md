# Coderic Relay ⚡

**Real-time messaging infrastructure**

Coderic Relay es un gateway de comunicación en tiempo real con Socket.io, Redis y Kafka.

## Instalación

```bash
npm install @coderic/relay
```

## Uso Rápido

### Como servidor standalone

```bash
# Con npx
npx @coderic/relay

# O con variables de entorno
PORT=5000 REDIS_URL=redis://localhost:6379 npx @coderic/relay
```

### Como librería en tu proyecto

```javascript
import { createRelay } from '@coderic/relay';

const gateway = createRelay({
  port: 5000,
  redis: { url: 'redis://localhost:6379' },
  kafka: { brokers: ['localhost:9092'] }
});

// Eventos personalizados
gateway.on('connection', (socket) => {
  console.log('Nueva conexión:', socket.id);
});

gateway.on('message', ({ socket, data }) => {
  console.log('Mensaje de', socket.data.usuario, ':', data);
});

await gateway.start();
```

### Cliente Node.js

```javascript
import { RelayClient } from '@coderic/relay';

const client = new RelayClient('http://localhost:5000');
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

### Cliente navegador

```html
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
<script>
const socket = io('http://localhost:5000/relay');

socket.on('connect', () => {
  socket.emit('identificar', 'miUsuario', (ok) => {
    console.log('Identificado:', ok);
  });
});

// Enviar mensaje a todos
socket.emit('relay', { 
  texto: 'Hola!',
  destino: 'nosotros' 
});

// Recibir mensajes
socket.on('relay', (data) => {
  console.log('Mensaje:', data);
});
</script>
```

## API de Eventos

### Eventos del cliente

| Evento | Descripción | Payload |
|--------|-------------|---------|
| `identificar` | Identificar usuario | `(userId, callback)` |
| `unirse` | Unirse a un room (v2.1) | `(room, callback)` |
| `notificar` | Enviar notificación | `{ ...data, destino }` |
| `relay` | Canal genérico | `{ ...data, destino }` |

### Destinos

| Destino | Descripción |
|---------|-------------|
| `yo` | Solo al emisor (default) |
| `ustedes` | A todos menos el emisor |
| `nosotros` | A todos incluyendo el emisor |
| `room` | A todos en el room especificado (v2.1) |

### Ejemplo con Rooms

```javascript
// Unirse a un room
socket.emit('unirse', 'aulaA');

// Enviar a ese room
socket.emit('relay', {
  destino: 'room',
  room: 'aulaA',
  tipo: 'mensaje',
  texto: 'Hola aula A'
});
```

## Configuración

### Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `5000` |
| `REDIS_URL` | URL de Redis | - |
| `KAFKA_BROKERS` | Brokers Kafka (comma-separated) | - |
| `INSTANCE_ID` | ID de instancia | `process.pid` |

### Opciones del constructor

```javascript
const gateway = createRelay({
  port: 5000,
  instanceId: 'gateway-1',
  namespace: '/relay',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  metrics: true,
  redis: {
    url: 'redis://localhost:6379',
    options: { /* ioredis options */ }
  },
  kafka: {
    brokers: ['localhost:9092'],
    topic: 'relay-events',
    options: { /* kafkajs options */ }
  },
  httpHandler: (req, res) => { /* custom handler */ }
});
```

## Eventos del servidor

```javascript
gateway.on('ready', ({ port }) => { });
gateway.on('connection', (socket) => { });
gateway.on('disconnect', ({ socket, reason }) => { });
gateway.on('user:identified', ({ usuario, socketId }) => { });
gateway.on('message', ({ socket, data }) => { });
gateway.on('notify', ({ socket, data }) => { });
gateway.on('redis:connected', () => { });
gateway.on('redis:error', (error) => { });
gateway.on('kafka:connected', () => { });
gateway.on('kafka:error', (error) => { });
```

## Endpoints HTTP

| Endpoint | Descripción |
|----------|-------------|
| `/health` | Health check (JSON) |
| `/metrics` | Métricas Prometheus |

## Docker

```bash
docker pull coderic/relay
```

```dockerfile
FROM coderic/relay:latest
ENV PORT=5000
ENV REDIS_URL=redis://redis:6379
ENV KAFKA_BROKERS=kafka:9092
EXPOSE 5000
CMD ["node", "src/server.js"]
```

## Ejemplos

### Básicos

#### 💬 Chat - Colección Completa
4 ejemplos: Básico, Rooms, Video, Llamadas WebRTC

- 📦 [Repositorio](https://github.com/Coderic/chat) | 🐛 [Issues](https://github.com/Coderic/chat/issues) | 🌐 [Demo](https://coderic.org/chat/)

#### 🍕 Pizza Delivery
Tracking de pedidos

- 📦 [Repositorio](https://github.com/Coderic/pizza-delivery) | 🐛 [Issues](https://github.com/Coderic/pizza-delivery/issues) | 🌐 [Demo](https://coderic.org/pizza-delivery/)

#### 🎫 Booking de Eventos
Reserva de eventos

- 📦 [Repositorio](https://github.com/Coderic/booking-eventos) | 🐛 [Issues](https://github.com/Coderic/booking-eventos/issues) | 🌐 [Demo](https://coderic.org/booking-eventos/)

### Reservas y Booking

#### 🚌 Bus Express
Reserva de autobuses (React)

- 📦 [Repositorio](https://github.com/Coderic/bus) | 🐛 [Issues](https://github.com/Coderic/bus/issues) | 🌐 [Demo](https://coderic.org/bus/)

#### ✈️ SkyBooker
Reserva de vuelos (Angular)

- 📦 [Repositorio](https://github.com/Coderic/aerolinea) | 🐛 [Issues](https://github.com/Coderic/aerolinea/issues) | 🌐 [Demo](https://coderic.org/aerolinea/)

#### 🏨 Hotel Booking
Reserva de hoteles (Vue.js)

- 📦 [Repositorio](https://github.com/Coderic/hotel) | 🐛 [Issues](https://github.com/Coderic/hotel/issues) | 🌐 [Demo](https://coderic.org/hotel/)

#### 🎬 Cine
Reserva de asientos de cine (Svelte)

- 📦 [Repositorio](https://github.com/Coderic/cine) | 🐛 [Issues](https://github.com/Coderic/cine/issues) | 🌐 [Demo](https://coderic.org/cine/)

### Otros Casos de Uso

#### 💳 PasaPay
Pagos P2P estilo Nequi (Vue.js)

- 📦 [Repositorio](https://github.com/Coderic/pagos) | 🐛 [Issues](https://github.com/Coderic/pagos/issues) | 🌐 [Demo](https://coderic.org/pagos/)

#### 🔨 Subastas
Sistema de subastas en tiempo real (React)

- 📦 [Repositorio](https://github.com/Coderic/subastas) | 🐛 [Issues](https://github.com/Coderic/subastas/issues) | 🌐 [Demo](https://coderic.org/subastas/)

#### 🏦 Cola de Turnos
Sistema de cola tipo banco

- 📦 [Repositorio](https://github.com/Coderic/cola-turnos) | 🐛 [Issues](https://github.com/Coderic/cola-turnos/issues) | 🌐 [Demo](https://coderic.org/cola-turnos/)

## Website

🌐 [relay.coderic.net](https://relay.coderic.net)

## Licencia

MIT © [Coderic](https://github.com/Coderic)
