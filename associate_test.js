suite('associate', function() {
  var docker = require('./docker')();
  var Associate = require('./associate');
  var uuid = require('uuid');

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
          console.log(value);
          throw new Error('container should be missing');
        },

        function(err) {
          assert.ok(err.message.indexOf('404') !== -1);
        }
      );
    });
  });
});
