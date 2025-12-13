# Pasarela Gateway 🌉

Gateway de comunicación en tiempo real con Socket.io, Redis y Kafka.

## Instalación

```bash
npm install pasarela-gateway
```

## Uso Rápido

### Como servidor standalone

```bash
# Con npx
npx pasarela-gateway

# O con variables de entorno
PORT=5000 REDIS_URL=redis://localhost:6379 npx pasarela-gateway
```

### Como librería en tu proyecto

```javascript
import { createPasarela } from 'pasarela-gateway';

const gateway = createPasarela({
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
import { PasarelaClient } from 'pasarela-gateway';

const client = new PasarelaClient('http://localhost:5000');
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
const socket = io('http://localhost:5000/pasarela');

socket.on('connect', () => {
  socket.emit('identificar', 'miUsuario', (ok) => {
    console.log('Identificado:', ok);
  });
});

// Enviar mensaje a todos
socket.emit('pasarela', { 
  texto: 'Hola!',
  destino: 'nosotros' 
});

// Recibir mensajes
socket.on('pasarela', (data) => {
  console.log('Mensaje:', data);
});
</script>
```

## API de Eventos

### Eventos del cliente

| Evento | Descripción | Payload |
|--------|-------------|---------|
| `identificar` | Identificar usuario | `(userId, callback)` |
| `notificar` | Enviar notificación | `{ ...data, destino }` |
| `pasarela` | Canal genérico | `{ ...data, destino }` |

### Destinos

| Destino | Descripción |
|---------|-------------|
| `yo` | Solo al emisor (default) |
| `ustedes` | A todos menos el emisor |
| `nosotros` | A todos incluyendo el emisor |

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
const gateway = createPasarela({
  port: 5000,
  instanceId: 'gateway-1',
  namespace: '/pasarela',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  metrics: true,
  redis: {
    url: 'redis://localhost:6379',
    options: { /* ioredis options */ }
  },
  kafka: {
    brokers: ['localhost:9092'],
    topic: 'pasarela-events',
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

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 5000
CMD ["node", "src/server.js"]
```

## Ejemplos

- [Chat en tiempo real](https://github.com/Coderic/pasarela-ejemplo-chat)
- [Pizza Delivery](https://github.com/Coderic/pasarela-ejemplo-pizza-delivery)
- [Booking de Eventos](https://github.com/Coderic/pasarela-ejemplo-booking-eventos)
- [Bus Express](https://github.com/Coderic/pasarela-ejemplo-bus) (React)
- [SkyBooker](https://github.com/Coderic/pasarela-ejemplo-aerolinea) (Angular)
- [PasaPay](https://github.com/Coderic/pasarela-ejemplo-pagos) (Vue.js)

## Licencia

MIT © [Coderic](https://github.com/Coderic)
