import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

function HomepageHeader() {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          ⚡ Relay
        </Heading>
        <p className="hero__subtitle">Gateway de comunicación en tiempo real</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro">
            Documentación →
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout
      title="Relay"
      description="Relay - Gateway de comunicación en tiempo real con Socket.io, Redis y Kafka">
      <HomepageHeader />
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              <div className="col col--4">
                <div className="text--center padding-horiz--md">
                  <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🔒</div>
                  <h3>Inmutable</h3>
                  <p>El gateway no se modifica para cada proyecto. Los clientes se conectan y definen su propia lógica.</p>
                </div>
              </div>
              <div className="col col--4">
                <div className="text--center padding-horiz--md">
                  <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🎯</div>
                  <h3>Agnóstico</h3>
                  <p>El identificador puede ser cualquier cosa: nickname, UID, deviceId, sessionId...</p>
                </div>
              </div>
              <div className="col col--4">
                <div className="text--center padding-horiz--md">
                  <div style={{fontSize: '3rem', marginBottom: '1rem'}}>⚡</div>
                  <h3>Simple</h3>
                  <p>Solo 3 eventos: identificar, notificar, relay. Destinos: yo, ustedes, nosotros.</p>
                </div>
              </div>
            </div>
            <div className="row" style={{marginTop: '2rem'}}>
              <div className="col col--4">
                <div className="text--center padding-horiz--md">
                  <div style={{fontSize: '3rem', marginBottom: '1rem'}}>📈</div>
                  <h3>Escalable</h3>
                  <p>Múltiples instancias con Redis Adapter. HAProxy como balanceador.</p>
                </div>
              </div>
              <div className="col col--4">
                <div className="text--center padding-horiz--md">
                  <div style={{fontSize: '3rem', marginBottom: '1rem'}}>📊</div>
                  <h3>Observable</h3>
                  <p>Métricas Prometheus, dashboards Grafana, Kafka para eventos asíncronos.</p>
                </div>
              </div>
              <div className="col col--4">
                <div className="text--center padding-horiz--md">
                  <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🐳</div>
                  <h3>Containerizado</h3>
                  <p>Docker Compose listo para producción con todo el stack incluido.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section style={{padding: '2rem 0', background: 'var(--ifm-background-surface-color)'}}>
          <div className="container">
            <div className="row">
              <div className="col col--6">
                <h2>Casos de Uso</h2>
                <ul>
                  <li>💬 Chat en tiempo real</li>
                  <li>🍕 Tracking de pedidos</li>
                  <li>🎫 Booking con disponibilidad en vivo</li>
                  <li>🎮 Juegos multijugador</li>
                  <li>📊 Dashboards colaborativos</li>
                  <li>🏠 IoT y domótica</li>
                </ul>
              </div>
              <div className="col col--6">
                <h2>Ejemplo Rápido</h2>
                <pre style={{background: '#1e1e1e', padding: '1rem', borderRadius: '8px', color: '#d4d4d4'}}>
{`const socket = io('http://localhost:5000/relay');

socket.emit('identificar', 'mi-usuario');

socket.emit('relay', { 
  destino: 'nosotros',
  tipo: 'saludo',
  mensaje: 'Hola!' 
});

socket.on('relay', (data) => {
  console.log(data);
});`}
                </pre>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

