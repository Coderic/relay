// Pasarela Gateway Monitor - Cliente en tiempo real

const PASARELA_URL = window.location.origin;
let socket = null;
let logs = [];
let isPaused = false;
let messageCount = 0;
let startTime = Date.now();
let messageCountPerMin = 0;
let messageCountInterval = null;

// Filtros
let currentFilters = {
  level: 'all',
  category: 'all',
  search: ''
};

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
  initSocket();
  initControls();
  initStats();
});

// Conectar a Socket.io
function initSocket() {
  socket = io(`${PASARELA_URL}/monitor`, {
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    updateStatus('connected', 'Conectado');
    console.log('[Monitor] Conectado al servidor');
  });

  socket.on('disconnect', () => {
    updateStatus('disconnected', 'Desconectado');
    console.log('[Monitor] Desconectado del servidor');
  });

  socket.on('connect_error', (error) => {
    updateStatus('error', 'Error de conexión');
    console.error('[Monitor] Error:', error);
  });

  // Recibir logs históricos
  socket.on('logs:history', (historyLogs) => {
    logs = historyLogs;
    renderLogs();
    updateLogCount();
  });

  // Recibir nuevo log
  socket.on('log', (logEntry) => {
    if (!isPaused) {
      addLog(logEntry);
    }
  });

  // Recibir estadísticas
  socket.on('stats', (stats) => {
    updateStats(stats);
  });
}

// Agregar log
function addLog(logEntry) {
  logs.push(logEntry);
  
  // Mantener máximo de logs
  if (logs.length > 1000) {
    logs.shift();
  }
  
  // Incrementar contador de mensajes
  if (logEntry.category === 'message') {
    messageCount++;
    messageCountPerMin++;
  }
  
  renderLogs();
  updateLogCount();
  updateMessageStats();
}

// Renderizar logs
function renderLogs() {
  const container = document.getElementById('logs-container');
  
  // Filtrar logs
  let filteredLogs = logs.filter(log => {
    if (currentFilters.level !== 'all' && log.level !== currentFilters.level) {
      return false;
    }
    if (currentFilters.category !== 'all' && log.category !== currentFilters.category) {
      return false;
    }
    if (currentFilters.search) {
      const searchLower = currentFilters.search.toLowerCase();
      const messageMatch = log.message.toLowerCase().includes(searchLower);
      const dataMatch = JSON.stringify(log.data).toLowerCase().includes(searchLower);
      if (!messageMatch && !dataMatch) {
        return false;
      }
    }
    return true;
  });
  
  if (filteredLogs.length === 0) {
    container.innerHTML = '<div class="log-empty">No hay logs que coincidan con los filtros</div>';
    return;
  }
  
  // Mostrar últimos logs primero
  filteredLogs = filteredLogs.slice().reverse();
  
  container.innerHTML = filteredLogs.map(log => {
    const time = new Date(log.timestamp).toLocaleTimeString('es', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    
    return `
      <div class="log-entry log-${log.level}">
        <div class="log-header">
          <div>
            <span class="log-time">${time}</span>
            <span class="log-level level-${log.level}">${log.level}</span>
            <span class="log-category">[${log.category}]</span>
            ${log.instance ? `<span class="log-category">#${log.instance}</span>` : ''}
          </div>
        </div>
        <div class="log-message">${escapeHtml(log.message)}</div>
        ${Object.keys(log.data).length > 0 ? `
          <div class="log-data">${formatData(log.data)}</div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  // Auto-scroll si está al final
  if (container.scrollTop === 0) {
    container.scrollTop = 0;
  }
}

// Formatear datos
function formatData(data) {
  try {
    return JSON.stringify(data, null, 2);
  } catch (e) {
    return String(data);
  }
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Actualizar contador de logs
function updateLogCount() {
  const count = logs.length;
  document.getElementById('log-count').textContent = `${count} logs`;
}

// Actualizar estado
function updateStatus(status, text) {
  const indicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  
  indicator.className = `status-indicator ${status}`;
  statusText.textContent = text;
}

// Inicializar controles
function initControls() {
  // Botón limpiar
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('¿Limpiar todos los logs?')) {
      logs = [];
      renderLogs();
      updateLogCount();
    }
  });
  
  // Botón pausar
  document.getElementById('btn-pause').addEventListener('click', () => {
    isPaused = !isPaused;
    const btn = document.getElementById('btn-pause');
    btn.textContent = isPaused ? '▶️ Reanudar' : '⏸️ Pausar';
    btn.classList.toggle('btn-primary', isPaused);
  });
  
  // Botón exportar
  document.getElementById('btn-export').addEventListener('click', () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pasarela-logs-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
  
  // Filtros
  document.getElementById('filter-level').addEventListener('change', (e) => {
    currentFilters.level = e.target.value;
    renderLogs();
  });
  
  document.getElementById('filter-category').addEventListener('change', (e) => {
    currentFilters.category = e.target.value;
    renderLogs();
  });
  
  document.getElementById('filter-search').addEventListener('input', (e) => {
    currentFilters.search = e.target.value;
    renderLogs();
  });
}

// Inicializar estadísticas
function initStats() {
  // Actualizar mensajes por minuto cada minuto
  messageCountInterval = setInterval(() => {
    document.getElementById('stat-messages-per-min').textContent = messageCountPerMin;
    messageCountPerMin = 0;
  }, 60000);
  
  // Actualizar uptime cada segundo
  setInterval(() => {
    const uptime = Date.now() - startTime;
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);
    document.getElementById('stat-uptime').textContent = 
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, 1000);
}

// Actualizar estadísticas
function updateStats(stats) {
  document.getElementById('stat-connections').textContent = stats.connections || 0;
  document.getElementById('stat-active-connections').textContent = stats.connections || 0;
  document.getElementById('stat-total-messages').textContent = messageCount;
  document.getElementById('stat-redis').textContent = stats.redis ? 'Online' : 'Offline';
  document.getElementById('stat-redis').className = `stat-status ${stats.redis ? 'online' : 'offline'}`;
  document.getElementById('stat-kafka').textContent = stats.kafka ? 'Online' : 'Offline';
  document.getElementById('stat-kafka').className = `stat-status ${stats.kafka ? 'online' : 'offline'}`;
  
  if (stats.instance) {
    document.getElementById('instance-badge').textContent = `Instancia: ${stats.instance}`;
  }
}

// Actualizar estadísticas de mensajes
function updateMessageStats() {
  document.getElementById('stat-messages').textContent = messageCountPerMin;
}

