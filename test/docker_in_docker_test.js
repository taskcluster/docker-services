suite('docker in docker (integration)', function() {
  var fsPath = require('path');
  var exec = require('child_process').exec;
  var binPath = fsPath.join(__dirname + '/../bin/docker-services');

  test('run docker in docker app', function(done) {
    var envs = {};
    for (var key in process.env) envs[key] = process.env[key];

    var options = {
      cwd: __dirname + '/../examples/docker_in_docker/',
      env: envs
    };

    exec(
      [binPath, 'exec', 'app'].join(' '),
      options,
      function(err, stdout, stderr) {
        if (err) return done(err);
        var json = JSON.parse(stdout.trim());
        assert.ok(json.Version, 'runs the correct command');
        done();
      }
    );
  });
});
