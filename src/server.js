#!/usr/bin/env node
/**
 * Servidor standalone de Pasarela
 * 
 * Uso:
 *   npx pasarela-gateway
 *   node src/server.js
 * 
 * Variables de entorno:
 *   PORT - Puerto del servidor (default: 5000)
 *   REDIS_URL - URL de Redis para clustering
 *   KAFKA_BROKERS - Brokers de Kafka separados por coma
 *   INSTANCE_ID - ID de instancia
 */

import 'dotenv/config';
import { createPasarela } from './Pasarela.js';
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

// Configuración desde variables de entorno
const config = {
  port: parseInt(process.env.PORT) || 5000,
  instanceId: process.env.INSTANCE_ID || process.pid.toString(),
  redis: process.env.REDIS_URL ? { url: process.env.REDIS_URL } : null,
  kafka: process.env.KAFKA_BROKERS ? { 
    brokers: process.env.KAFKA_BROKERS.split(',') 
  } : null,
  httpHandler: existsSync(PUBLIC_DIR) ? staticHandler : null
};

console.log('Pasarela Gateway v2.0');
console.log(`Puerto: ${config.port}`);
console.log(`Instancia: ${config.instanceId}`);
console.log(`Redis: ${config.redis ? 'Configurado' : 'No configurado'}`);
console.log(`Kafka: ${config.kafka ? 'Configurado' : 'No configurado'}`);

// Crear e iniciar el gateway
const gateway = createPasarela(config);

gateway.on('ready', ({ port }) => {
  console.log(`Servidor listo en http://localhost:${port}`);
});

gateway.on('redis:connected', () => {
  console.log('Redis adapter activado');
});

gateway.on('kafka:connected', () => {
  console.log('Kafka producer activado');
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
