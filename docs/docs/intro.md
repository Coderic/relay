# Introducción

Relay es un **gateway de comunicación en tiempo real** diseñado para ser **inmutable** y **agnóstico**. Esto significa que el gateway no se modifica para cada proyecto; los clientes se conectan y definen su propia lógica de negocio.

## Filosofía

### 🔒 Inmutable

El gateway no cambia. Todos los proyectos usan la misma API:

- **3 eventos**: `identificar`, `notificar`, `relay`
- **3 destinos**: `yo`, `ustedes`, `nosotros`
- **Sin configuración**: El gateway no necesita saber qué tipo de aplicación estás construyendo

### 🎯 Agnóstico

El identificador puede ser **cualquier cosa** que tenga sentido para tu aplicación:

- `nickname` para chats
- `userId` para aplicaciones multi-usuario
- `deviceId` para IoT
- `orderId` para tracking de pedidos
- `sessionId` para reservas
- `playerId` para juegos

### ⚡ Simple

```javascript
// 1. Conectar
const relay = new RelayConector('http://demo.relay.coderic.net');
await relay.conectar();

// 2. Identificar
await relay.identificar('mi-usuario-123');

// 3. Enviar y recibir
relay.enviarATodos({ tipo: 'saludo', mensaje: 'Hola!' });
relay.on('relay', (data) => console.log(data));
```

## Casos de Uso

Relay es perfecto para:

- 💬 **Chat y mensajería** - Chat multi-usuario, indicadores de escritura, presencia
- 🍕 **Delivery y tracking** - Seguimiento de pedidos en tiempo real
- 🎫 **Booking y reservas** - Disponibilidad en vivo, prevención de overbooking
- 🎮 **Gaming** - Juegos multijugador, sincronización de estados
- 📊 **Dashboards** - Métricas en tiempo real, colaboración
- 🏠 **IoT y domótica** - Control de dispositivos, sensores
- 📱 **Apps colaborativas** - Documentos compartidos, whiteboards
- 🛒 **E-commerce** - Carrito compartido, stock en tiempo real

## Demo en Vivo

Prueba Relay ahora mismo con nuestro monitor en tiempo real:

🔗 **[http://demo.relay.coderic.net/](http://demo.relay.coderic.net/)**

Este monitor te permite ver:
- Conexiones activas
- Mensajes por minuto
- Logs en tiempo real
- Estado de Redis, Kafka y MongoDB
- Estadísticas del sistema

## Arquitectura

Relay está construido con:

- **Socket.io** - Comunicación WebSocket
- **Redis** - Adapter para múltiples instancias
- **Kafka** - Eventos asíncronos
- **MongoDB** - Persistencia opcional
- **Prometheus** - Métricas
- **HAProxy** - Balanceador de carga

## Próximos Pasos

- [Instalación](/docs/instalacion) - Cómo instalar y configurar Relay
- [API](/docs/api) - Referencia completa de la API
- [Ejemplos](/docs/ejemplos) - Proyectos de ejemplo funcionales
- [Arquitectura](/docs/arquitectura) - Detalles técnicos y escalabilidad

