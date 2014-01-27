var URL = require('url');
var http = require('http');
var assert = require('assert');

var dockerHost = URL.parse(process.env.DOCKER_PORT);
dockerHost.protocol = 'http:';
dockerHost.pathname = 'version';

http.get(URL.format(dockerHost), function(req) {
  assert.equal(req.statusCode, 200);
  req.pipe(process.stdout);
  req.once('end', process.exit.bind(process, 0));
});
