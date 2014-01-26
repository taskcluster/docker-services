var net = require('net');

var server = net.createServer(function(connection) {
  console.log('got connection!', connection.address());
  connection.end('WORKER');
});

server.listen(60022);
