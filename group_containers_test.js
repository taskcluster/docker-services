suite('group_containers', function() {
  var uuid = require('uuid');
  var cmdConfig = require('./examples/node_cmd/docker_services.json');
  var serverConfig = require('./examples/node_server/docker_services.json');
  var docker = require('./docker')();

  var GroupContainers = require('./group_containers');

  var subject;
  var name;
  setup(function() {
    name = uuid.v4();
    subject = new GroupContainers(docker, cmdConfig, name);
  });

  teardown(function() {
    return subject.removeServices();
  });

  teardown(function() {
    return subject.associate.delete();
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
          assert.equal(result.Config.Image, cmdConfig.worker.image);
        }
      );
    });

    suite('with linking', function() {
      // find the name
      var name;
      setup(function() {
        return docker.getContainer(id).inspect().then(
          function(result) {
            name = result.Name;
          }
        );
      });

      test('launch with linked node', function() {
        var container;
        return subject._deamonize('app', { worker: name }).then(
          function(id) {
            container = docker.getContainer(id);
            return container.wait();
          }
        ).then(
          function(result) {
            // This will fail if the link is not created correctly
            assert.equal(result.StatusCode, 0);
          }
        ).then(
          function() {
            return container.remove();
          }
        );
      });
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

  suite('#_startDependencyGroups', function() {
    var deps;
    setup(function() {
      subject = new GroupContainers(docker, serverConfig, name);
      deps = subject.config.dependencyGroups();
    });

    suite('worker is created but not running', function() {

      var workerId;
      setup(function() {
        return subject._deamonize('worker').then(
          function(id) {
            workerId = id;
          }
        );
      });

      setup(function() {
        return subject._stop(workerId);
      });

      setup(function() {
        return subject._startDependencyGroups(deps);
      });

      test('app is launched only one worker is running', function() {
        return subject.inspectServices().then(
          function(result) {
            var workers = result.worker;
            var apps = result.app;
            assert.equal(workers.length, 1);
            assert.ok(workers[0].running, 'worker is running');
            assert.ok(apps[0].running, 'app is running');
          }
        );
      });
    });

    suite('worker is running', function() {

      setup(function() {
        return subject._deamonize('worker');
      });

      setup(function() {
        return subject._startDependencyGroups(deps);
      });

      test('app is launched only one worker is running', function() {
        return subject.inspectServices().then(
          function(result) {
            var workers = result.worker;
            var apps = result.app;
            assert.equal(workers.length, 1);
            assert.ok(workers[0].running, 'worker is running');
            assert.ok(apps[0].running, 'app is running');
          }
        );
      });
    });

    suite('nothing is running', function() {
      var links;
      setup(function() {
        return subject._startDependencyGroups(deps).then(
          function(result) {
            links = result;
          }
        );
      });

      test('returned links', function() {
        assert.ok(links.worker);
        assert.ok(links.app);
      });

      test('everything should be launched', function() {
        return subject.inspectServices().then(
          function(result) {
            assert.ok(result.worker, 'has worker');
            assert.ok(result.app, 'has app');

            var worker = result.worker[0];
            var app = result.app[0];

            assert.ok(worker.running, 'worker is running');
            assert.ok(app.running, 'app is running');
          }
        );
      });
    });
  });

  suite('#inspectServices', function() {
    var id;
    setup(function() {
      // launch a worker node
      return subject._deamonize('worker').then(
        function(_id) {
          id = _id;
        }
      );
    });

    test.skip('with removed service', function() {
      // XXX: Handle the case where the user has removed the container
      //      manually.
    });

    test('with stopped service', function() {
      return subject._stop(id).then(
        function() {
          return subject.inspectServices();
        }
      ).then(
        function(services) {
          var workers = services.worker;
          assert.ok(workers.length, 'has workers');
          assert.equal(workers[0].running, false);
        }
      );
    });

    test('with running service', function() {
      return subject.inspectServices().then(
        function services(services) {
          var workers = services.worker;
          assert.ok(workers.length, 'has workers');
          var worker = workers[0];
          assert.equal(worker.running, true);
          assert.ok(worker.name, 'has .name');
          assert.ok(worker.id, 'has .id');
        }
      );
    });
  });

  suite('#spawn', function() {
    suite('simple one dependency', function() {
      var dockerProc;
      setup(function() {
        return subject.spawn('app').then(
          function(proc) {
            dockerProc = proc;
          }
        );
      });

      test('returns docker process', function() {
        assert.ok(dockerProc, 'returns proc');
        assert.equal(dockerProc.exitCode, null);

        return dockerProc.exec().then(
          function() {
            assert.equal(dockerProc.exitCode, 0);
          }
        );
      });
    });
  });

  suite('#up', function() {
    test('all services', function() {
      return subject.startServices().then(
        function() { return subject.inspectServices() }
      ).then(
        function(services) {
          assert.ok(services.worker, 'has workers');
          assert.ok(services.app, 'has apps');
          assert.equal(services.worker[0].running, true);
          assert.equal(services.app[0].running, true);
        }
      );
    });

    test('worker only', function() {
      return subject.startServices(['worker']).then(
        function() { return subject.inspectServices() }
      ).then(
        function(services) {
          assert.ok(services.worker, 'has workers');
          assert.ok(!services.app, 'has apps');
          assert.equal(services.worker[0].running, true);
        }
      );
    });
  });

  suite('#stopServices', function() {
    suite('everything', function() {
      setup(function() {
        return subject.startServices();
      });

      setup(function() {
        return subject.stopServices();
      });

      test('nothing is running', function() {
        return subject.inspectServices().then(
          function services(services) {
            assert.ok(services.worker, 'has worker');
            assert.ok(services.app, 'has app');

            assert.ok(!services.worker[0].running, 'worker is off');
            assert.ok(!services.app[0].running, 'app is off');
          }
        );
      });
    });
  });

  suite('#removeServices', function() {
    setup(function() {
      return subject.startServices();
    });

    setup(function() {
      return subject.removeServices();
    });

    test('everything is removed', function() {
      return subject.inspectServices().then(
        function services(services) {
          assert.equal(Object.keys(services).length, 0);
        }
      );
    });
  });
});
