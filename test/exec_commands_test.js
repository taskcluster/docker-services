suite('exec commands', function() {
  var fsPath = require('path');
  var exec = require('child_process').exec;
  var binPath = fsPath.join(__dirname + '/../bin/docker-services');

  test('run command in base image', function(done) {
    exec(
      [
        binPath,
        'exec',
        '--services-config', 'examples/node_cmd/docker_services.json',
        'app', 'ls'
      ].join(' '),
      function(err, stdout, stderr) {
        done(err);
      }
    );
  });
});
