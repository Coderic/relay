/**
 * Coderic Relay - Real-time messaging infrastructure
 * 
 * @example
 * // Uso como paquete
 * import { Relay, createRelay } from '@coderic/relay';
 * 
 * const gateway = createRelay({
 *   port: 5000,
 *   redis: { url: 'redis://localhost:6379' },
 *   kafka: { brokers: ['localhost:9092'] }
 * });
 * 
 * await gateway.start();
 */

export { Relay, createRelay } from './Relay.js';
export { RelayClient } from './client.js';
