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

    test('duplicate links (on same level)', function() {
      var subject = new GroupConifg({
        app: { links: ['proxy:proxy', 'proxy:proxy'] },
        proxy: { links: ['monit'] }
      });

      assert.ok(subject.errors().length);
    });
  });

  suite('#dependencyGroups', function() {
    test('multi-tier', function() {
      var subject = new GroupConifg({
        app: { image: 'app', links: ['db:db', 'queue:queue'] },
        db: { image: 'db', links: ['monit:monit', 'xvfb:xvfb'] },
        queue: { image: 'queue', links: ['monit:monit', 'amqp:amqp'] },
        monit: { image: 'monit' },
        xvfb: { image: 'xvfb' },
        amqp: { image: 'amqp' }
      });

      var order = [
        ['monit', 'xvfb', 'amqp'],
        ['db', 'queue'],
        ['app']
      ];

      var expected = order.map(function(group) {
        return group.map(function(service) {
          return subject.services[service];
        });
      });


      var result = subject.dependencyGroups('app');
      assert.deepEqual(result, expected);
    });
  });
});
