# Ejemplos

Relay incluye varios ejemplos funcionales que demuestran diferentes casos de uso. Todos los ejemplos están disponibles en producción y puedes probarlos directamente.

## 🍕 Pizza Delivery

Sistema de pedidos de pizza con tracking en tiempo real. Demuestra cómo sincronizar estados entre múltiples vistas (cliente y cocina).

- 📦 [Repositorio](https://github.com/Coderic/pizza-delivery)
- 🐛 [Issues](https://github.com/Coderic/pizza-delivery/issues)
- 🌐 [Demo en línea](https://oss.coderic.org/pizza-delivery/)

**Características**:
- Vista Cliente: Selecciona pizzas y realiza pedidos
- Vista Cocina: Gestiona los pedidos y actualiza estados
- Tracking en tiempo real: Observa el progreso de tu pedido

**Estados del pedido**:
1. 📝 **Recibido** - Pedido registrado
2. 👨‍🍳 **Preparando** - En la cocina
3. 🔥 **Horneando** - En el horno
4. ✅ **Listo** - Esperando repartidor
5. 🛵 **En Camino** - El repartidor va hacia ti
6. 🎉 **Entregado** - ¡Buen provecho!

**Código de ejemplo**:

```javascript
// Conectar a Relay
const relay = new RelayConector('wss://demo.relay.coderic.net');
await relay.conectar();

// Enviar nuevo pedido (cliente)
relay.enviarATodos({
  tipo: 'nuevo_pedido',
  pedidoId: 'ABC123',
  pizza: 'Pepperoni',
  precio: 14.99
});

// Actualizar estado (cocina)
relay.enviarATodos({
  tipo: 'estado_pedido',
  pedidoId: 'ABC123',
  estado: 'preparando'
});

// Escuchar actualizaciones
relay.on('relay', (data) => {
  if (data.tipo === 'estado_pedido') {
    actualizarTracking(data.estado);
  }
});
```

**Identificador usado**: `deviceId` (generado automáticamente)

## 💬 Chat - Colección Completa

Colección de 4 ejemplos de chat demostrando todas las capacidades de Relay v2.2.

- 📦 [Repositorio](https://github.com/Coderic/chat)
- 🐛 [Issues](https://github.com/Coderic/chat/issues)
- 🌐 [Demo en línea](https://oss.coderic.org/chat/)

**Ejemplos incluidos:**

1. **Chat Básico** - Mensajería multi-usuario en tiempo real
2. **Chat con Rooms** - Segmentación por salas (v2.1+)
3. **Chat con Video** - Texto + video llamadas (v2.2+)
4. **Llamadas WebRTC** - Aplicación completa de video llamadas

**Características**:
- Chat multi-usuario
- Rooms para segmentación
- Video llamadas P2P
- Audio en tiempo real
- Compartir pantalla
- Identificación por nickname
- Mensajes en tiempo real

**Código de ejemplo**:

```javascript
// Conectar a Relay
const relay = new RelayConector('wss://demo.relay.coderic.net');
await relay.conectar();

// Identificarse
await relay.identificar('MiNombre');

// Enviar mensaje a todos
relay.enviarATodos({
  tipo: 'mensaje',
  texto: 'Hola a todos!'
});

// Recibir mensajes
relay.on('relay', (data) => {
  if (data.tipo === 'mensaje') {
    console.log(`${data.usuario}: ${data.texto}`);
  }
});
```

**Identificador usado**: `nickname` del usuario

## 🎫 Booking de Eventos

Sistema de reserva de eventos con disponibilidad en tiempo real. Demuestra cómo prevenir overbooking y sincronizar disponibilidad.

- 📦 [Repositorio](https://github.com/Coderic/booking-eventos)
- 🐛 [Issues](https://github.com/Coderic/booking-eventos/issues)
- 🌐 [Demo en línea](https://oss.coderic.org/booking-eventos/)

**Características**:
- Selección de asientos/lugares
- Disponibilidad en tiempo real
- Prevención de overbooking
- Sincronización multi-usuario

**Código de ejemplo**:

```javascript
// Conectar a Relay
const relay = new RelayConector('wss://demo.relay.coderic.net');
await relay.conectar();

// Seleccionar asiento
relay.enviarATodos({
  tipo: 'seleccionar_asiento',
  asientoId: 'A1',
  usuario: 'Juan'
});

// Reservar
relay.enviarATodos({
  tipo: 'reservar',
  asientoId: 'A1',
  usuario: 'Juan'
});

// Escuchar cambios
relay.on('relay', (data) => {
  if (data.tipo === 'asiento_ocupado') {
    marcarAsientoOcupado(data.asientoId);
  }
});
```

**Identificador usado**: `sessionId` o `visitorId`

## 🔗 Monitor en Tiempo Real

Prueba todos los ejemplos y observa el tráfico en tiempo real con nuestro monitor:

**Monitor**: [http://demo.relay.coderic.net/](http://demo.relay.coderic.net/)

El monitor te permite ver:
- 👥 Conexiones activas
- 📨 Mensajes totales
- ⚡ Mensajes por minuto
- 🔴 Estado de Redis
- 📨 Estado de Kafka
- 🍃 Estado de MongoDB
- 🕐 Uptime del sistema
- 📋 Logs en tiempo real

## Más Ejemplos

Relay tiene más ejemplos disponibles en GitHub:

### Reservas y Booking

#### 🚌 Bus Express
Reserva de autobuses con React

- 📦 [Repositorio](https://github.com/Coderic/bus)
- 🐛 [Issues](https://github.com/Coderic/bus/issues)
- 🌐 [Demo en línea](https://oss.coderic.org/bus/)

#### ✈️ SkyBooker
Reserva de vuelos con Angular

- 📦 [Repositorio](https://github.com/Coderic/aerolinea)
- 🐛 [Issues](https://github.com/Coderic/aerolinea/issues)
- 🌐 [Demo en línea](https://oss.coderic.org/aerolinea/)

#### 🏨 Hotel Booking
Reserva de hoteles con Vue.js

- 📦 [Repositorio](https://github.com/Coderic/hotel)
- 🐛 [Issues](https://github.com/Coderic/hotel/issues)
- 🌐 [Demo en línea](https://oss.coderic.org/hotel/)

#### 🎬 Cine
Reserva de asientos de cine con Svelte

- 📦 [Repositorio](https://github.com/Coderic/cine)
- 🐛 [Issues](https://github.com/Coderic/cine/issues)
- 🌐 [Demo en línea](https://oss.coderic.org/cine/)

### Otros Casos de Uso

#### 💳 PasaPay
Pagos P2P estilo Nequi con Vue.js

- 📦 [Repositorio](https://github.com/Coderic/pagos)
- 🐛 [Issues](https://github.com/Coderic/pagos/issues)
- 🌐 [Demo en línea](https://oss.coderic.org/pagos/)

#### 🔨 Subastas
Sistema de subastas en tiempo real con React

- 📦 [Repositorio](https://github.com/Coderic/subastas)
- 🐛 [Issues](https://github.com/Coderic/subastas/issues)
- 🌐 [Demo en línea](https://oss.coderic.org/subastas/)

#### 🏦 Cola de Turnos
Sistema de cola tipo banco con múltiples operadores

- 📦 [Repositorio](https://github.com/Coderic/cola-turnos)
- 🐛 [Issues](https://github.com/Coderic/cola-turnos/issues)
- 🌐 [Demo en línea](https://oss.coderic.org/cola-turnos/)

## Crear tu Propio Ejemplo

1. Incluye Socket.io y conector.js:

```html
<script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
<script src="conector.js"></script>
```

2. Conecta y usa:

```javascript
const relay = new RelayConector('wss://demo.relay.coderic.net');
await relay.conectar();
await relay.identificar('mi-id');

// Define tus propios tipos de mensajes
relay.enviarATodos({ 
  tipo: 'mi_evento',
  datos: { /* tus datos */ }
});

relay.on('relay', (data) => {
  if (data.tipo === 'mi_evento') {
    // Tu lógica aquí
  }
});
```

## Patrón de Implementación

Todos los ejemplos siguen el mismo patrón:

1. **Conectar** - Establecer conexión con Relay
2. **Identificar** - Usar un ID que tenga sentido para tu app
3. **Enviar** - Usar `enviarATodos`, `enviarAOtros` o `enviarAMi`
4. **Recibir** - Escuchar el evento `relay` y filtrar por `tipo`

Este patrón funciona para cualquier caso de uso, desde chats hasta sistemas IoT complejos.

