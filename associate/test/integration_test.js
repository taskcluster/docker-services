// XXX: replace docker exec with api calls.
suite('running as docker deamon', function() {
  this.timeout('50s');

  var version = require(__dirname + '/../../package.json').version;
  var exec = require('child_process').exec;
  var spawn = require('child_process').spawn;
  var http = require('http');

  // run it as a deamon
  var containerId;
  setup(function(done) {
    exec(
      'docker run -p 60044 -d lightsofapollo/docker-service-associate',
      function(err, _containerId) {
        containerId = _containerId.trim();
        done(err);
      }
    );
  });

  // get the port
  var host;
  setup(function(done) {
    exec(
      'docker port ' + containerId + ' 60044',
      function onPort(err, stdout) {
        host = stdout.trim();
        done(err);
      }
    );
  });

  teardown(function(done) {
    exec('docker stop ' + containerId, done);
  });

  teardown(function(done) {
    exec('docker rm' + containerId, done);
  });

  // get url but retry if it fails.
  function get(url, callback) {
    var req = http.get(url);
    req.once('response', callback);
    req.once('error', function() {
      setTimeout(get, 100, url, callback);
    });
  }

  test('it exposes the connection port', function(done) {
    var addr = 'http://' + host + '/services';

    // we use a retry mechanism since the socket is not always available when
    // run is done.
    get(addr, function(res) {
      assert.equal(res.statusCode, 200);
      res.resume();
      done();
    });
  });
});
