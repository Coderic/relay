# Sistema de Plugins

Relay incluye un sistema de plugins que permite extender funcionalidad de forma opcional sin modificar el core. Los plugins son completamente opcionales y pueden activarse o desactivarse según necesidad.

## Filosofía de Plugins

Los plugins en Relay siguen estos principios:

1. **Opcionales**: No son requeridos para el funcionamiento básico
2. **No modifican la API**: Usan la API estándar de Relay (`relay`, `notificar`, `unirse`)
3. **Independientes**: No dependen entre sí (ej: WebRTC no depende de MongoDB)
4. **Extensibles**: Fácil de crear nuevos plugins

## Plugins Disponibles

### MongoDB Plugin

Plugin de persistencia opcional para almacenar mensajes, conexiones y eventos.

**Activar:**
```javascript
const gateway = createRelay({
  plugins: {
    mongo: {
      url: 'mongodb://localhost:27017/relay'
    }
  }
});
```

**Documentación**: Ver [MongoDB Plugin](/docs/plugins-mongo)

### WebRTC Plugin

Plugin de señalización WebRTC para video/audio en tiempo real.

**Activar:**
```javascript
const gateway = createRelay({
  plugins: {
    webrtc: {} // Activado por defecto, usar false para desactivar
  }
});
```

**Documentación**: Ver [WebRTC Plugin](/docs/plugins-webrtc)

## Crear tu Propio Plugin

### Estructura Básica

Un plugin debe extender la clase `RelayPlugin`:

```javascript
import { RelayPlugin } from '@coderic/relay/plugins';

export class MiPlugin extends RelayPlugin {
  constructor(options = {}) {
    super('mi-plugin', options);
    // Inicializar estado del plugin
  }

  /**
   * Inicializa el plugin
   * @returns {Promise<void>}
   */
  async initialize() {
    await super.initialize();
    // Tu lógica de inicialización
    this.emit('initialized');
  }

  /**
   * Configura handlers para el namespace (opcional)
   * Se llama automáticamente después de _setupSocketIO()
   * @param {Namespace} namespace - Namespace de Socket.io
   */
  setupHandlers(namespace) {
    namespace.on('connection', (socket) => {
      // Escuchar mensajes usando la API de Relay
      socket.on('relay', (data) => {
        if (data.tipo === 'mi-plugin:accion') {
          this.handleAccion(socket, data);
        }
      });
    });
  }

  /**
   * Cierra el plugin
   * @returns {Promise<void>}
   */
  async shutdown() {
    // Limpiar recursos
    await super.shutdown();
  }
}
```

### Registrar el Plugin

En `src/Relay.js`, en el método `_setupPlugins()`:

```javascript
async _setupPlugins() {
  // ... otros plugins ...

  // Tu plugin
  if (this.options.plugins.miPlugin !== false) {
    try {
      const { MiPlugin } = await import('./plugins/mi-plugin.js');
      const miPlugin = new MiPlugin(this.options.plugins.miPlugin || {});
      
      await miPlugin.initialize();
      registerPlugin('miPlugin', miPlugin);
      
      this._emitLog('success', 'mi-plugin', 'Mi plugin activado', { 
        instance: this.options.instanceId 
      });
      this.emit('plugin:mi-plugin:ready');
      console.log(`[Relay ${this.options.instanceId}] Mi plugin activado`);
    } catch (error) {
      this.emit('plugin:mi-plugin:error', error);
      console.log(`[Relay ${this.options.instanceId}] Mi plugin no disponible:`, error.message);
    }
  }
}
```

Y en `_setupSocketIO()`, después de crear el namespace:

```javascript
_setupSocketIO() {
  // ... código existente ...
  
  // Setup handlers de tu plugin
  const miPlugin = getPlugin('miPlugin');
  if (miPlugin?.isEnabled()) {
    miPlugin.setupHandlers(this.namespace);
  }
}
```

### Usar la API de Relay

**IMPORTANTE**: Los plugins deben usar la API estándar de Relay, no crear eventos propios.

✅ **Correcto** - Usar la API de Relay:
```javascript
// Enviar mensaje usando la API de Relay
socket.emit('relay', {
  destino: 'room',
  room: 'mi-room',
  tipo: 'mi-plugin:accion',
  datos: { /* ... */ }
});

// Escuchar mensajes
socket.on('relay', (data) => {
  if (data.tipo === 'mi-plugin:accion') {
    // Procesar
  }
});
```

❌ **Incorrecto** - Crear eventos propios:
```javascript
// NO hacer esto
socket.emit('mi-plugin:accion', data);
socket.on('mi-plugin:accion', handler);
```

### Ejemplo Completo

```javascript
import { RelayPlugin } from './index.js';

export class NotificacionesPlugin extends RelayPlugin {
  constructor(options = {}) {
    super('notificaciones', options);
    this.notificaciones = new Map();
  }

  async initialize() {
    await super.initialize();
    console.log('Plugin de notificaciones inicializado');
  }

  setupHandlers(namespace) {
    namespace.on('connection', (socket) => {
      socket.on('relay', (data) => {
        if (data.tipo === 'notificacion:enviar') {
          this.enviarNotificacion(socket, data);
        }
      });
    });
  }

  enviarNotificacion(socket, data) {
    const { usuario, mensaje } = data;
    
    // Usar la API de Relay para enviar
    socket.to(data.room).emit('relay', {
      tipo: 'notificacion:recibida',
      usuario,
      mensaje,
      timestamp: Date.now()
    });
  }

  async shutdown() {
    this.notificaciones.clear();
    await super.shutdown();
  }
}
```

## Mejores Prácticas

1. **Usa la API de Relay**: No crees eventos propios, usa `relay` con tipos de mensaje
2. **Sé independiente**: No dependas de otros plugins
3. **Maneja errores**: Usa try/catch y emite eventos de error
4. **Limpia recursos**: Implementa `shutdown()` correctamente
5. **Documenta**: Explica qué hace tu plugin y cómo usarlo
6. **Usa tipos de mensaje**: Prefijo único para tus mensajes (ej: `mi-plugin:accion`)

## Eventos del Plugin

Los plugins pueden emitir eventos:

```javascript
// En el plugin
this.emit('evento-personalizado', { datos });

// En el código que usa Relay
gateway.on('plugin:mi-plugin:evento-personalizado', (data) => {
  console.log('Evento del plugin:', data);
});
```

## Acceder a un Plugin

```javascript
import { getPlugin } from '@coderic/relay/plugins';

const miPlugin = getPlugin('miPlugin');
if (miPlugin?.isEnabled()) {
  // Usar el plugin
}
```

## Desactivar un Plugin

```javascript
const gateway = createRelay({
  plugins: {
    webrtc: false,  // Desactivar WebRTC
    mongo: false    // Desactivar MongoDB
  }
});
```

## Plugins Incluidos

- **MongoDB**: Persistencia opcional de mensajes y conexiones
- **WebRTC**: Señalización para video/audio en tiempo real

## Contribuir

Si creas un plugin útil, considera:

1. Documentarlo completamente
2. Incluir ejemplos de uso
3. Añadir tests si es posible
4. Proponer incluirlo en el repositorio oficial

---

**Nota**: Los plugins son una forma poderosa de extender Relay sin modificar el core, manteniendo la filosofía de inmutabilidad.

