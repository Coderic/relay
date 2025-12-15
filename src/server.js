#!/usr/bin/env node
/**
 * Servidor standalone de Coderic Relay
 * 
 * Uso:
 *   npx @coderic/relay
 *   node src/server.js
 * 
 * Variables de entorno:
 *   PORT - Puerto del servidor (default: 5000)
 *   REDIS_URL - URL de Redis para clustering
 *   KAFKA_BROKERS - Brokers de Kafka separados por coma
 *   MONGO_URL - URL de conexión a MongoDB
 *   MONGO_DB_NAME - Nombre de la base de datos (default: relay)
 *   INSTANCE_ID - ID de instancia
 *   WEBRTC_ENABLED - Habilitar plugin WebRTC (default: true, usar 'false' para desactivar)
 */

import 'dotenv/config';
import { createRelay } from './Relay.js';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

// Tipos MIME para archivos estáticos
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Handler HTTP para servir archivos estáticos
function staticHandler(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  const fullPath = join(PUBLIC_DIR, filePath);
  
  if (existsSync(fullPath)) {
    const ext = extname(fullPath);
    const mimeType = MIME_TYPES[ext] || 'text/plain';
    res.setHeader('Content-Type', mimeType + '; charset=utf-8');
    res.end(readFileSync(fullPath));
    return;
  }
  
  res.statusCode = 404;
  res.end('Not Found');
}

// Configuración CORS desde variables de entorno
const corsOrigin = process.env.CORS_ORIGIN || '*';
const corsMethods = process.env.CORS_METHODS || 'GET,POST';

// Parsear CORS_ORIGIN si es una lista separada por comas
const corsConfig = {
  origin: corsOrigin.includes(',') ? corsOrigin.split(',').map(o => o.trim()) : corsOrigin,
  methods: corsMethods.split(',').map(m => m.trim()),
  credentials: process.env.CORS_CREDENTIALS === 'true'
};

// Configuración desde variables de entorno
const config = {
  port: parseInt(process.env.PORT) || 5000,
  instanceId: process.env.INSTANCE_ID || process.pid.toString(),
  redis: process.env.REDIS_URL ? { url: process.env.REDIS_URL } : null,
  kafka: process.env.KAFKA_BROKERS ? { 
    brokers: process.env.KAFKA_BROKERS.split(',') 
  } : null,
  cors: corsConfig,
  plugins: {
    // Plugin MongoDB (opcional)
    mongo: process.env.MONGO_URL ? {
      url: process.env.MONGO_URL,
      dbName: process.env.MONGO_DB_NAME || 'relay',
      collections: {
        messages: process.env.MONGO_COLLECTIONS_MESSAGES || 'messages',
        connections: process.env.MONGO_COLLECTIONS_CONNECTIONS || 'connections',
        events: process.env.MONGO_COLLECTIONS_EVENTS || 'events',
        logs: process.env.MONGO_COLLECTIONS_LOGS || 'logs'
      }
    } : null,
    // Plugin WebRTC (habilitado por defecto, desactivar con WEBRTC_ENABLED=false)
    webrtc: process.env.WEBRTC_ENABLED === 'false' ? false : undefined
  },
  httpHandler: existsSync(PUBLIC_DIR) ? staticHandler : null
};

console.log('Coderic Relay v2.0');
console.log(`Puerto: ${config.port}`);
console.log(`Instancia: ${config.instanceId}`);
console.log(`CORS Origin: ${Array.isArray(config.cors.origin) ? config.cors.origin.join(', ') : config.cors.origin}`);
console.log(`Redis: ${config.redis ? 'Configurado' : 'No configurado'}`);
console.log(`Kafka: ${config.kafka ? 'Configurado' : 'No configurado'}`);
console.log(`MongoDB Plugin: ${config.plugins.mongo ? 'Configurado' : 'No configurado (opcional)'}`);

// Crear e iniciar el gateway
const gateway = createRelay(config);

gateway.on('ready', ({ port }) => {
  console.log(`Servidor listo en http://localhost:${port}`);
});

gateway.on('redis:connected', () => {
  console.log('Redis adapter activado');
});

gateway.on('kafka:connected', () => {
  console.log('Kafka producer activado');
});

gateway.on('plugin:mongo:connected', () => {
  console.log('MongoDB plugin activado');
});

gateway.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await gateway.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await gateway.stop();
  process.exit(0);
});
