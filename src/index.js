/**
 * Pasarela - Gateway de comunicación en tiempo real
 * 
 * @example
 * // Uso como paquete
 * import { Pasarela, createPasarela } from 'pasarela-gateway';
 * 
 * const gateway = createPasarela({
 *   port: 5000,
 *   redis: { url: 'redis://localhost:6379' },
 *   kafka: { brokers: ['localhost:9092'] }
 * });
 * 
 * await gateway.start();
 */

export { Pasarela, createPasarela } from './Pasarela.js';
export { PasarelaClient } from './client.js';

