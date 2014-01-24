suite('associate', function() {
  var Promise = require('promise');
  var Associate = require('./associate');

  var docker = require('./docker')();
  var uuid = require('uuid');
  var request = require('./request');

  var subject;
  var name;
  setup(function() {
    // a new name is generated each time to ensure we don't connect to
    // old instances which did not get cleaned up.
    name = uuid.v4();
    subject = new Associate(docker, name);
  });

  teardown(function() {
    return subject.delete();
  });

  test('#isUp', function(done) {
    return subject.isUp().then(
      function isUpValue(result) {
        assert.ok(!result, 'should not be up before launching container');
      }
    );
  });

  suite('#up', function() {
    test('when the container is not up', function(done) {
      return subject.up().then(
        function(container) {
          return subject.isUp();
        }
      ).then(
        function isUpResult(isUp) {
          assert.ok(isUp);
        }
      );
    });
  });

  suite('#down', function() {
    setup(function() {
      return subject.up();
    });

    setup(function() {
      return subject.down();
    });

    test('container is off', function() {
      return subject.isUp().then(
        function(isUp) {
          assert.ok(!isUp);
        }
      );
    });
  });

  suite('#delete', function() {
    setup(function() {
      return subject.up();
    });

    setup(function(done) {
      return subject.delete();
    });

    test('container is gone', function() {
      return docker.getContainer(subject.name).inspect().then(
        function(value) {
          throw new Error('container should be missing');
        },

        function(err) {
          assert.ok(err.message.indexOf('404') !== -1);
        }
      );
    });
  });

  test('#apiUrl', function() {
    return subject.apiUrl().then(
      function issueRequest(url) {
        return request('GET', url + '/services').end();
      }
    ).then(
      function(res) {
        assert.deepEqual(res.body, {});
      }
    );
  });

  test('#getServices', function() {
    return subject.getServices().then(
      function serviceList(items) {
        assert.deepEqual(items, []);
      }
    );
  });

  suite('#addContainer', function() {
    setup(function() {
      var promises = [];
      promises.push(subject.addContainer(1, 'foo'));
      promises.push(subject.addContainer(2, 'bar'));

      return Promise.all(promises);
    });

    test('list containers', function() {
      return subject.getServices().then(
        function serviceList(items) {
          assert.deepEqual(items, {
            foo: [{ id: 1, service: 'foo' }],
            bar: [{ id: 2, service: 'bar' }]
          });
        }
      );
    });

    test('remove then list', function() {
      return subject.removeContainer(1).then(
        function list() { return subject.getServices() }
      ).then(
        function handleList(items) {
          assert.deepEqual(items, {
            bar: [{ id: 2, service: 'bar' }]
          });
        }
      );
    });
  });
});
