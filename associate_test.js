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

  suite('#install', function() {
    this.timeout('100s');
    setup(function() {
      // install it
      return subject.install();
    });

    test('image is available', function() {
      return docker.listImages({ filter: subject.image }).then(
        function onList(list) {
          assert.ok(list);
        }
      );
    });
  });
});
