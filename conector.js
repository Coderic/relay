socket = io.connect('http://' + window.location.hostname + ':' + window.location.port + '/relay');
socket.on('error', function (razon) {
    console.error('No se pudo conectar', razon);
});
socket.on('connect', function () {
    console.log("Sesión: " + this.socket.sessionid);
    console.log("Conectado con éxito - 200");
    socket.emit('identificar', 'webmaster', function (data) {
        console.log(data ? data : 'FAIL');
    });
    socket.on('notificar', function (data) {
        notify(data.titulo, data.mensaje, {icon: '/img/demo/icon.png', system: true});
    });
    socket.on('comunicador', function (data) {
        console.dir(data);
    });
    socket.on('proceso', function (data) {
        console.log(data);
    });
    socket.on('disconnect', function () {
        console.log("Usted se ha desconectado");
    });
});
 
