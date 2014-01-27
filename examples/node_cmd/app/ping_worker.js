var URL = require('url');
var net = require('net');
var assert = require('assert');

assert(process.env.WORKER_PORT, 'has worker');
var parsed = URL.parse(process.env.WORKER_PORT);

process.stdout.write('stdout');
process.stderr.write('stderr');

function connectToWorker() {
  console.log('connecting....', process.env);
  var client = net.createConnection(
    parsed.port,
    parsed.hostname,
    function connected(socket) {
      console.log('pinged worker');
      client.end();
    }
  );

  client.setTimeout(1000, function() {
    console.log('failed to connect to socket');
    process.exit(1);
  });
}

connectToWorker();
