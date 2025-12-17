# Plugin MongoDB

Plugin opcional de persistencia para Relay que proporciona almacenamiento de mensajes, conexiones, eventos y logs en MongoDB.

## Características

- ✅ Persistencia de mensajes
- ✅ Registro de conexiones y desconexiones
- ✅ Almacenamiento de eventos
- ✅ Sistema de logs
- ✅ Índices optimizados para consultas rápidas
- ✅ Configuración flexible de colecciones
- ✅ Manejo automático de errores
- ✅ Completamente opcional (no afecta el funcionamiento si no está configurado)

## Activación

El plugin MongoDB está desactivado por defecto. Para activarlo:

**Opción 1: Variable de entorno (recomendado para Docker)**

```bash
MONGO_URL=mongodb://localhost:27017/relay
MONGO_DB_NAME=relay
```

**Opción 2: Configuración programática**

```javascript
const gateway = createRelay({
  plugins: {
    mongo: {
      url: 'mongodb://localhost:27017/relay',
      dbName: 'relay',
      collections: {
        messages: 'messages',
        connections: 'connections',
        events: 'events',
        logs: 'logs'
      }
    }
  }
});
```

## Configuración

### Parámetros

- `url` (requerido): URL de conexión a MongoDB
  - Ejemplo: `mongodb://localhost:27017/relay`
  - Ejemplo con autenticación: `mongodb://usuario:password@localhost:27017/relay`
  - Ejemplo con réplicas: `mongodb://host1:27017,host2:27017/relay?replicaSet=rs0`

- `dbName` (opcional): Nombre de la base de datos (default: `relay`)

- `collections` (opcional): Nombres personalizados de colecciones
  - `messages`: Colección de mensajes (default: `messages`)
  - `connections`: Colección de conexiones (default: `connections`)
  - `events`: Colección de eventos (default: `events`)
  - `logs`: Colección de logs (default: `logs`)

### Variables de Entorno

```bash
MONGO_URL=mongodb://localhost:27017/relay
MONGO_DB_NAME=relay
MONGO_COLLECTIONS_MESSAGES=messages
MONGO_COLLECTIONS_CONNECTIONS=connections
MONGO_COLLECTIONS_EVENTS=events
MONGO_COLLECTIONS_LOGS=logs
```

## Estructura de Datos

### Mensajes (`messages`)

```javascript
{
  usuario: 'usuario-123',
  destino: 'room',
  room: 'mi-room',
  tipo: 'mensaje',
  datos: { /* ... */ },
  timestamp: ISODate('2024-01-01T00:00:00.000Z')
}
```

### Conexiones (`connections`)

```javascript
{
  socketId: 'socket-id-123',
  usuario: 'usuario-123',
  connectedAt: ISODate('2024-01-01T00:00:00.000Z'),
  updatedAt: ISODate('2024-01-01T00:00:00.000Z'),
  disconnectedAt: ISODate('2024-01-01T01:00:00.000Z'), // Solo si está desconectado
  disconnectReason: 'client disconnect' // Solo si está desconectado
}
```

### Eventos (`events`)

```javascript
{
  tipo: 'evento-tipo',
  datos: { /* ... */ },
  timestamp: ISODate('2024-01-01T00:00:00.000Z')
}
```

### Logs (`logs`)

```javascript
{
  nivel: 'info', // 'info', 'warn', 'error', 'success'
  mensaje: 'Mensaje de log',
  datos: { /* ... */ },
  timestamp: ISODate('2024-01-01T00:00:00.000Z')
}
```

## API del Plugin

### Acceder al Plugin

```javascript
import { getPlugin } from '@coderic/relay/plugins';

const mongoPlugin = getPlugin('mongo');
if (mongoPlugin?.isEnabled()) {
  // Usar el plugin
}
```

### Métodos Disponibles

#### `saveMessage(message)`

Guarda un mensaje en la base de datos.

```javascript
const mongoPlugin = getPlugin('mongo');
if (mongoPlugin?.isEnabled()) {
  await mongoPlugin.saveMessage({
    usuario: 'usuario-123',
    destino: 'room',
    room: 'mi-room',
    tipo: 'mensaje',
    datos: { contenido: 'Hola mundo' }
  });
}
```

#### `saveConnection(connection)`

Guarda o actualiza una conexión.

```javascript
const mongoPlugin = getPlugin('mongo');
if (mongoPlugin?.isEnabled()) {
  await mongoPlugin.saveConnection({
    socketId: 'socket-id-123',
    usuario: 'usuario-123',
    connectedAt: new Date()
  });
}
```

#### `updateConnectionDisconnect(socketId, reason)`

Actualiza el estado de desconexión de una conexión.

```javascript
const mongoPlugin = getPlugin('mongo');
if (mongoPlugin?.isEnabled()) {
  await mongoPlugin.updateConnectionDisconnect('socket-id-123', 'client disconnect');
}
```

#### `saveEvent(event)`

Guarda un evento.

```javascript
const mongoPlugin = getPlugin('mongo');
if (mongoPlugin?.isEnabled()) {
  await mongoPlugin.saveEvent({
    tipo: 'usuario-joined',
    datos: { usuario: 'usuario-123', room: 'mi-room' }
  });
}
```

#### `saveLog(log)`

Guarda un log.

```javascript
const mongoPlugin = getPlugin('mongo');
if (mongoPlugin?.isEnabled()) {
  await mongoPlugin.saveLog({
    nivel: 'info',
    mensaje: 'Usuario conectado',
    datos: { usuario: 'usuario-123' }
  });
}
```

#### `getClient()`

Obtiene el cliente MongoDB para consultas avanzadas.

```javascript
const mongoPlugin = getPlugin('mongo');
if (mongoPlugin?.isEnabled()) {
  const client = mongoPlugin.getClient();
  
  // Consultar mensajes de un usuario
  const mensajes = await client.getMessagesByUser('usuario-123', {
    limit: 50,
    skip: 0
  });
  
  // Obtener conexiones activas
  const conexiones = await client.getActiveConnections();
}
```

#### `isConnected()`

Verifica si el plugin está conectado a MongoDB.

```javascript
const mongoPlugin = getPlugin('mongo');
if (mongoPlugin?.isConnected()) {
  console.log('MongoDB conectado');
}
```

## Eventos del Plugin

El plugin emite eventos que puedes escuchar:

```javascript
gateway.on('plugin:mongo:connected', () => {
  console.log('MongoDB plugin conectado');
});

gateway.on('plugin:mongo:error', (error) => {
  console.error('Error en MongoDB plugin:', error);
});
```

## Índices

El plugin crea automáticamente los siguientes índices para optimizar las consultas:

### Mensajes
- `{ usuario: 1, timestamp: -1 }` - Búsqueda por usuario ordenada por fecha
- `{ timestamp: -1 }` - Ordenamiento por fecha
- `{ tipo: 1, timestamp: -1 }` - Búsqueda por tipo ordenada por fecha

### Conexiones
- `{ usuario: 1 }` - Búsqueda por usuario
- `{ socketId: 1 }` (único) - Búsqueda por socket ID
- `{ connectedAt: -1 }` - Ordenamiento por fecha de conexión
- `{ disconnectedAt: 1 }` - Búsqueda de conexiones desconectadas

### Eventos
- `{ timestamp: -1 }` - Ordenamiento por fecha
- `{ tipo: 1, timestamp: -1 }` - Búsqueda por tipo ordenada por fecha

### Logs
- `{ timestamp: -1 }` - Ordenamiento por fecha
- `{ nivel: 1, timestamp: -1 }` - Búsqueda por nivel ordenada por fecha

## Integración Automática

El plugin se integra automáticamente con Relay y persiste:

- **Mensajes**: Todos los mensajes enviados a través de `relay`
- **Conexiones**: Cuando un usuario se conecta o desconecta
- **Eventos**: Eventos del sistema (si se configuran)
- **Logs**: Logs del sistema (si se configuran)

No necesitas hacer nada adicional, el plugin funciona automáticamente una vez activado.

## Ejemplo Completo

```javascript
import { createRelay } from '@coderic/relay';

const gateway = createRelay({
  instanceId: 'relay-1',
  port: 5000,
  plugins: {
    mongo: {
      url: process.env.MONGO_URL || 'mongodb://localhost:27017/relay',
      dbName: 'relay',
      collections: {
        messages: 'messages',
        connections: 'connections',
        events: 'events',
        logs: 'logs'
      }
    }
  }
});

// Escuchar eventos del plugin
gateway.on('plugin:mongo:connected', () => {
  console.log('✅ MongoDB plugin conectado');
});

gateway.on('plugin:mongo:error', (error) => {
  console.error('❌ Error en MongoDB plugin:', error.message);
});

// Iniciar el gateway
await gateway.start();
```

## Consultas Útiles

### Obtener mensajes recientes de un usuario

```javascript
const mongoPlugin = getPlugin('mongo');
if (mongoPlugin?.isEnabled()) {
  const client = mongoPlugin.getClient();
  const mensajes = await client.getMessagesByUser('usuario-123', {
    limit: 100,
    skip: 0
  });
}
```

### Obtener conexiones activas

```javascript
const mongoPlugin = getPlugin('mongo');
if (mongoPlugin?.isEnabled()) {
  const client = mongoPlugin.getClient();
  const conexiones = await client.getActiveConnections();
  console.log(`Hay ${conexiones.length} conexiones activas`);
}
```

### Consultas personalizadas con MongoDB

```javascript
const mongoPlugin = getPlugin('mongo');
if (mongoPlugin?.isEnabled()) {
  const client = mongoPlugin.getClient();
  const db = client.db;
  const collection = db.collection('messages');
  
  // Consulta personalizada
  const resultado = await collection.find({
    tipo: 'mensaje',
    timestamp: { $gte: new Date('2024-01-01') }
  }).sort({ timestamp: -1 }).limit(50).toArray();
}
```

## Desactivar el Plugin

Para desactivar el plugin MongoDB:

```javascript
const gateway = createRelay({
  plugins: {
    mongo: false
  }
});
```

O simplemente no incluir la configuración de MongoDB.

## Troubleshooting

### El plugin no se conecta

- Verificar que MongoDB está corriendo
- Verificar la URL de conexión
- Revisar los logs: `[Relay] MongoDB plugin error: ...`
- Verificar permisos de la base de datos

### Errores de conexión

```bash
# Verificar que MongoDB está corriendo
mongosh mongodb://localhost:27017

# Verificar la URL en el código
console.log(process.env.MONGO_URL);
```

### El plugin no persiste datos

- Verificar que el plugin está conectado: `mongoPlugin.isConnected()`
- Revisar eventos de error: `gateway.on('plugin:mongo:error', ...)`
- Verificar que los datos se están enviando correctamente

### Performance

- Los índices se crean automáticamente
- Para grandes volúmenes, considera usar TTL indexes para limpiar datos antiguos
- Considera usar réplicas de MongoDB para alta disponibilidad

## Recursos

- [MongoDB Documentation](https://www.mongodb.com/docs/)
- [MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/current/)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (MongoDB en la nube)





