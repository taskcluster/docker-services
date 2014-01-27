suite('group_containers', function() {
  var uuid = require('uuid');
  var config = require('./examples/node/docker_services.json');
  var docker = require('./docker')();

  var GroupContainers = require('./group_containers');

  var subject;
  var name;
  setup(function() {
    name = uuid.v4();
    subject = new GroupContainers(docker, config, name);
  });

  suite('#_deamonize', function() {
    var id;
    setup(function() {
      return subject._deamonize('worker').then(
        function running(_id) {
          id = _id;
        }
      );
    });

    teardown(function() {
      return subject._stop(id);
    });

    // verify the worker was launched and get its id
    test('assoicate records', function() {
      return subject.associate.getServices().then(
        function list(services) {
          assert.ok(services.worker, 'has services');
          assert.equal(services.worker[0].id, id);
        }
      );
    });

    test('container is running', function() {
      return docker.getContainer(id).inspect().then(
        function onInspect(result) {
          assert.ok(result.State.Running, 'service is running');
          assert.equal(result.Config.Image, config.worker.image);
        }
      );
    });
  });

  suite('#_stop', function() {
    var id;
    setup(function() {
      return subject._deamonize('worker').then(
        function running(_id) {
          id = _id;
        }
      );
    });

    setup(function() {
      return subject._stop(id);
    });

    test('container should exist but be stopped', function() {
      return docker.getContainer(id).inspect().then(
        function inspected(result) {
          assert.equal(result.State.Running, false);
        }
      );
    });
  });

  suite('#_remove', function() {
    var id;
    setup(function() {
      return subject._deamonize('worker').then(
        function running(_id) {
          id = _id;
        }
      );
    });

    var container;
    setup(function() {
      container = docker.getContainer(id);
    });

    test('when not stopped should remove container', function() {
      return subject._remove(id).then(
        function() {
          return container.inspect();
        }
      ).then(
        function() { throw new Error('should have removed container') },
        function() {}
      );
    });

    test('when stopped should still remove container', function() {
      return container.stop().then(
        function() {
          return subject._remove(id);
        }
      ).then(
        function() {
          return container.inspect();
        }
      ).then(
        function(err) { throw new Error('should have removed container') },
        function() {}
      );
    });
  });

  suite('#inspectServices', function() {
    setup(function() {
      // launch a worker node
      return subject._deamonize('worker');
    });

    test('with running service', function() {
      return subject.inspectServices().then(
        function services(services) {
          var workers = services.worker;
          assert.ok(workers.length, 'has workers');
          assert.equal(workers[0].running, true);
        }
      );
    });
  });
});
