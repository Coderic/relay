# Instalación

## Instalación con npm

```bash
npm install @coderic/relay
```

## Uso Rápido

### Como servidor standalone

```bash
# Con npx (recomendado para pruebas)
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

await gateway.start();
```

## Docker

### Imagen oficial

```bash
docker pull coderic/relay
```

### Dockerfile de ejemplo

```dockerfile
FROM coderic/relay:latest
ENV PORT=5000
ENV REDIS_URL=redis://redis:6379
ENV KAFKA_BROKERS=kafka:9092
EXPOSE 5000
CMD ["node", "src/server.js"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  relay:
    image: coderic/relay:latest
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:9092
      # Opcional: Desactivar plugin WebRTC
      # - WEBRTC_ENABLED=false
    depends_on:
      - redis
      - kafka
```

## Configuración

### Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `5000` |
| `REDIS_URL` | URL de Redis | - |
| `WEBRTC_ENABLED` | Habilitar plugin WebRTC | `true` |
| `KAFKA_BROKERS` | Brokers Kafka (comma-separated) | - |
| `INSTANCE_ID` | ID de instancia | `process.pid` |
| `MONGODB_URL` | URL de MongoDB (opcional) | - |

### Opciones del constructor

```javascript
const gateway = createRelay({
  port: 5000,
  instanceId: 'gateway-1',
  namespace: '/relay',
  cors: { 
    origin: '*', 
    methods: ['GET', 'POST'] 
  },
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

## Verificación

Una vez iniciado, verifica que el servidor está funcionando:

```bash
# Health check
curl http://localhost:5000/health

# Métricas Prometheus
curl http://localhost:5000/metrics
```

## Próximos Pasos

- [API](/docs/api) - Aprende a usar la API de Relay
- [Ejemplos](/docs/ejemplos) - Ve ejemplos funcionales

