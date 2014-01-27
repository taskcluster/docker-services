suite('docker_run', function() {
  var DockerRun = require('./docker_proc');
  var GroupConfig = require('./group_config');

  var docker = require('./docker')();
  var config = require('./examples/node_cmd/docker_services');
  var groupConfig = new GroupConfig(config);

  var workerImage = config.worker.image;
  var appImage = config.app.image;

  // start the worker
  var workerContainer;
  setup(function() {
    var containerConfig = {
      Image: workerImage
    };

    var create = docker.createContainer(containerConfig);

    return create.then(
      function start(container) {
        workerContainer = docker.getContainer(container.id);
        return workerContainer.start({});
      }
    );
  });

  teardown(function() {
    return workerContainer.stop({}).then(
      function() {
        return workerContainer.remove();
      },
      // ignore errors
      function() {}
    );
  });

  // get the name of the container
  var linkName;
  setup(function() {
    return workerContainer.inspect().then(
      function result(value) {
        linkName = value.Name;
      }
    );
  });

  var subject;
  setup(function() {
    var links = { worker: linkName };

    subject = new DockerRun(docker, {
      create: groupConfig.dockerCreateConfig('app'),
      start: groupConfig.dockerStartConfig('app', links)
    });
  });

  suite('#exec', function() {
    var stdoutBuffer;
    var stderrBuffer;

    test('run docker image', function() {
      stderrBuffer = [];
      stdoutBuffer = [];

      function append(buffer, item) {
        buffer.push(item.toString());
      }

      var promise = subject.exec();

      assert.ok(subject.stdout, 'has stdout, stream');
      assert.ok(subject.stderr, 'has stderr stream');

      subject.stdout.on('data', append.bind(null, stdoutBuffer));
      subject.stderr.on('data', append.bind(null, stderrBuffer));
      assert.equal(subject.exitCode, null);


      var didExit = false;
      subject.once('exit', function() {
        didExit = true;
      });

      return promise.then(
        function(status) {
          assert.ok(stderrBuffer.length, 'has stderr');
          assert.ok(stdoutBuffer.length, 'has stdout');
          assert.equal(stdoutBuffer[0], 'stdout');
          assert.equal(stderrBuffer[0], 'stderr');

          assert.equal(subject.exitCode, 0);
          assert.ok(didExit, 'stream is marked as exited');
        }
      );
    });
  });
});
