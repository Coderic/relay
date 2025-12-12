# Pasarela v2.0 ⚡

Pasarela de comunicación en tiempo real modernizada con Node.js, Socket.io, Redis y Kafka.

## Características

- 🔌 **Socket.io 4.x** - Comunicación bidireccional en tiempo real
- 🔴 **Redis** - Adaptador para escalabilidad horizontal y almacenamiento de sesiones
- 📨 **Kafka** - Mensajería distribuida para eventos asíncronos
- 📊 **Prometheus** - Métricas expuestas para monitoreo
- 🐳 **Docker** - Contenedor listo para producción

## Endpoints

| Endpoint | Descripción |
|----------|-------------|
| `GET /` | Página de prueba interactiva |
| `GET /health` | Health check (JSON) |
| `GET /metrics` | Métricas para Prometheus |
| `WS /pasarela` | Namespace Socket.io |

## Eventos Socket.io

### Cliente → Servidor

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `identificar` | `usuario: string` | Identificar usuario |
| `notificar` | `{destino, titulo, mensaje}` | Enviar notificación |
| `pasarela` | `{destino, ...data}` | Enviar mensaje |

**Destinos disponibles:**
- `yo` - Solo al emisor
- `ustedes` - A todos excepto el emisor
- `nosotros` - A todos incluyendo el emisor

### Servidor → Cliente

| Evento | Descripción |
|--------|-------------|
| `notificar` | Notificación recibida |
| `pasarela` | Mensaje recibido |
| `events` | Eventos de Kafka |

## Ejecución

### Con Docker Compose (recomendado)

```bash
cd infraestructura
docker compose up -d
```

Acceder a:
- **Pasarela**: http://localhost:5000
- **Kafka UI**: http://localhost:8080
- **Redis Commander**: http://localhost:8081
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090

### Desarrollo local

```bash
npm install
npm run dev
```

## Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | 5000 | Puerto del servidor |
| `REDIS_URL` | redis://localhost:6379 | URL de Redis |
| `KAFKA_BROKERS` | localhost:9092 | Brokers de Kafka |

## Arquitectura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Cliente   │────▶│  Pasarela   │────▶│    Redis    │
│  (Browser)  │◀────│  (Node.js)  │◀────│  (Adapter)  │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    Kafka    │
                    │  (Events)   │
                    └─────────────┘
```

## Autor

**NeftaliYagua** - [GitHub](https://github.com/NeftaliYagua)

