suite('docker_run', function() {
  var DockerRun = require('./docker_exec');
  var docker = require('./docker')();
  var config = require('./examples/node_cmd/docker_services');

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
    return;

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
    subject = new DockerRun(docker, {
      create: {
        Image: appImage
      },
      start: { Links: [linkName + ':worker'] }
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

      subject.once('streams', function(stdout, stderr) {
        stdout.on('data', append.bind(null, stdoutBuffer));
        stderr.on('data', append.bind(null, stderrBuffer));
      });

      return subject.exec().then(
        function(status) {
          assert.ok(stderrBuffer.length, 'has stderr');
          assert.ok(stdoutBuffer.length, 'has stdout');
          assert.equal(stdoutBuffer[0], 'stdout');
          assert.equal(stderrBuffer[0], 'stderr');

          assert.equal(status.StatusCode, 0);
        }
      );
    });
  });
});
