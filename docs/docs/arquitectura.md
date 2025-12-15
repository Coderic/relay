# Arquitectura

Relay está diseñado para ser escalable, observable y fácil de mantener. Esta sección describe los componentes técnicos y cómo funcionan juntos.

## Componentes

### Socket.io

Relay usa **Socket.io** como base para la comunicación WebSocket. Socket.io proporciona:

- Fallback a HTTP long-polling si WebSocket no está disponible
- Reconexión automática
- Rooms y namespaces
- Adaptadores para escalabilidad

### Redis Adapter

Para soportar múltiples instancias de Relay, usamos el **Redis Adapter** de Socket.io:

```javascript
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
```

Esto permite que mensajes enviados a una instancia se propaguen a todas las demás instancias a través de Redis.

### Kafka

Kafka se usa para eventos asíncronos que necesitan persistencia o procesamiento posterior:

- Logs de eventos
- Análisis
- Integración con otros sistemas
- Event sourcing

### MongoDB (Opcional)

MongoDB puede usarse para persistir:

- Historial de mensajes
- Estados de usuarios
- Métricas históricas

### Prometheus

Relay expone métricas en formato Prometheus en el endpoint `/metrics`:

- `relay_connections_total` - Total de conexiones
- `relay_messages_total` - Total de mensajes (con labels: type, destination)
- Métricas de Node.js (CPU, memoria, event loop)

### HAProxy

Para producción, HAProxy actúa como balanceador de carga:

```
Cliente → HAProxy → Relay Instancia 1
                  → Relay Instancia 2
                  → Relay Instancia 3
                  → Relay Instancia 4
```

## Flujo de Mensajes

### Mensaje Simple (Una Instancia)

```
Cliente A → Relay → Cliente B
```

### Mensaje Multi-Instancia

```
Cliente A → Relay Instancia 1 → Redis → Relay Instancia 2 → Cliente B
                                                              → Relay Instancia 3 → Cliente C
```

1. Cliente A envía mensaje a Instancia 1
2. Instancia 1 determina destino (`nosotros`, `ustedes`, `yo`)
3. Instancia 1 envía a clientes locales
4. Instancia 1 publica en Redis para otras instancias
5. Instancias 2 y 3 reciben del Redis Adapter
6. Instancias 2 y 3 envían a sus clientes locales

## Escalabilidad

### Horizontal Scaling

Relay escala horizontalmente agregando más instancias:

```yaml
services:
  relay-1:
    image: coderic/relay:latest
  relay-2:
    image: coderic/relay:latest
  relay-3:
    image: coderic/relay:latest
  relay-4:
    image: coderic/relay:latest
  haproxy:
    # Balanceador de carga
```

### Redis como Backbone

Redis es el componente crítico que permite la escalabilidad:

- **Pub/Sub**: Propaga mensajes entre instancias
- **Adapter**: Socket.io usa Redis para sincronizar rooms
- **Baja latencia**: Mensajes se propagan en < 10ms típicamente

### Límites

- **Conexiones por instancia**: ~10,000 conexiones WebSocket
- **Mensajes por segundo**: Depende del hardware, típicamente 50k+ msg/s
- **Latencia**: < 50ms entre instancias (con Redis local)

## Observabilidad

### Métricas Prometheus

```prometheus
# Conexiones activas
relay_connections_total 42

# Mensajes por tipo
relay_messages_total{type="mensaje",destination="nosotros"} 1234
relay_messages_total{type="pedido",destination="ustedes"} 567

# Métricas de Node.js
nodejs_heap_size_total_bytes 52428800
nodejs_eventloop_lag_seconds 0.001
```

### Grafana Dashboards

Ejemplo de queries para Grafana:

```promql
# Mensajes por minuto
rate(relay_messages_total[1m])

# Conexiones activas
relay_connections_total

# Distribución de destinos
sum by (destination) (relay_messages_total)
```

### Logs

Relay puede emitir logs estructurados:

```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "info",
  "event": "message",
  "usuario": "user123",
  "tipo": "mensaje",
  "destino": "nosotros"
}
```

## Seguridad

### CORS

Configura CORS según tus necesidades:

```javascript
const gateway = createRelay({
  cors: {
    origin: 'https://tudominio.com',
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

### Autenticación

Relay no incluye autenticación por defecto. Puedes:

1. Validar tokens antes de identificar
2. Usar un middleware HTTP
3. Validar en el evento `connection`

```javascript
gateway.on('connection', (socket) => {
  const token = socket.handshake.auth.token;
  if (!validarToken(token)) {
    socket.disconnect();
    return;
  }
});
```

## Producción

### Docker Compose Completo

```yaml
version: '3.8'
services:
  relay-1:
    image: coderic/relay:latest
    environment:
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:9092
  relay-2:
    image: coderic/relay:latest
    environment:
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:9092
  redis:
    image: redis:7-alpine
  kafka:
    image: confluentinc/cp-kafka:latest
  haproxy:
    image: haproxy:latest
    ports:
      - "5000:5000"
```

### Health Checks

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Monitoreo

- **Health**: `/health` endpoint
- **Métricas**: `/metrics` endpoint (Prometheus)
- **Logs**: Estructurados para agregación

## Mejores Prácticas

1. **Usa Redis** para producción con múltiples instancias
2. **Configura CORS** apropiadamente
3. **Monitorea métricas** con Prometheus/Grafana
4. **Usa HAProxy** o similar para balanceo de carga
5. **Implementa health checks** en tu orquestador
6. **Valida identificadores** según tu lógica de negocio
7. **Usa tipos de mensaje** consistentes en tu aplicación

