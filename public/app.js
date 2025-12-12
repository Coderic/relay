// Pasarela Frontend
(function() {
  const dot = document.getElementById('dot');
  const statusText = document.getElementById('status-text');
  const statusEl = document.querySelector('.status');
  const instanceEl = document.getElementById('instance');

  // Obtener info del servidor
  fetch('/health')
    .then(res => res.json())
    .then(data => {
      instanceEl.textContent = `Instancia #${data.instance}`;
      dot.classList.add('online');
      statusEl.classList.add('connected');
      statusText.textContent = `Servidor activo - ${data.connections} conexiones`;
    })
    .catch(() => {
      statusText.textContent = 'Error de conexión';
    });

  // Conectar a Pasarela para mostrar conexiones en tiempo real
  const socket = io('/pasarela');
  
  socket.on('connect', () => {
    dot.classList.add('online');
    statusEl.classList.add('connected');
    updateStatus();
  });

  socket.on('disconnect', () => {
    dot.classList.remove('online');
    statusEl.classList.remove('connected');
    statusText.textContent = 'Desconectado';
  });

  function updateStatus() {
    fetch('/health')
      .then(res => res.json())
      .then(data => {
        statusText.textContent = `Servidor activo - ${data.connections} conexiones`;
      });
  }

  // Actualizar cada 5 segundos
  setInterval(updateStatus, 5000);
})();

