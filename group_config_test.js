suite('group_config', function() {
  var GroupConifg = require('./group_config');

  suite('initialize', function() {
    test('normalizes services', function() {
      var subject = new GroupConifg({
        'docker': { image: 'dind' }
      });

      assert.deepEqual(subject.services, {
        'docker': {
          links: [],
          image: 'dind',
          environment: {},
          ports: {}
        }
      });
    });
  });

  suite('#errors', function() {
    test('valid config', function() {
      var subject = new GroupConifg({
        'docker': { image: 'xfoo' }
      });
      assert.ok(!subject.errors().length);
    });

    test('no image', function() {
      var subject = new GroupConifg({
        'docker': {}
      });

      var errors = subject.errors();
      assert.ok(errors.length, 'has errors');
      assert.equal(errors[0].service, 'docker');
    });
  });
});
