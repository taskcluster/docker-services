suite('docker_utils', function() {
  var Promise = require('promise');
  var docker = require('./docker')();
  var subject = require('./docker_utils');

  suite('#pullImage', function() {
    // lightweight image that is fast to pull
    var image = 'lightsofapollo/test-taskenv';

    setup(function(done) {
      return subject.removeImageIfExists(docker, image);
    });

    test('pull the image', function() {
      return subject.pullImage(
        docker,
        image
      ).then(
        function findImage() {
          return docker.listImages({ filter: image });
        }
      ).then(
        function gotImages(image) {
          assert.ok(image.length);
        }
      );
    });
  });

  suite('#ensureImage', function() {
    // image with a specific tag
    var image = 'lightsofapollo/test-taskenv:pass';
    setup(function() {
      return subject.removeImageIfExists(docker, image);
    });

    test('when image exists', function() {
      return subject.pullImage(docker, image).then(
        function onImage() {
          return subject.ensureImage(docker, image);
        }
      ).then(
        function status(wasPulled) {
          assert.ok(!wasPulled);
        }
      );
    });

    test('when image does not exist', function() {
      return subject.ensureImage(docker, image).then(
        function status(wasPulled) {
          assert.ok(wasPulled);
        }
      ).then(
        function inspect() {
          return docker.getImage(image).inspect();
        }
      ).then(
        function onImage(inspection) {
          assert.ok(inspection);
        }
      );
    });

  });
});
