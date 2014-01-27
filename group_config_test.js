suite('group_config', function() {
  var GroupConifg = require('./group_config');

  suite('initialize', function() {
    test('normalizes services', function() {
      var subject = new GroupConifg({
        'docker': { image: 'dind' }
      });

      assert.deepEqual(subject.services, {
        'docker': {
          name: 'docker',
          links: [],
          image: 'dind',
          createConfig: {},
          startConfig: {}
        }
      });
    });
  });

  suite('#dockerCreateConfig', function() {
    var subject = new GroupConifg({
      docker: {
        image: 'dind',
        createConfig: {
          ExposedPorts: {
            '4243/tcp': {}
          }
        }
      }
    });


    test('with overrides', function() {
      var create = subject.dockerCreateConfig(
        'docker',
        { Override: true }
      );

      assert.equal(create.Image, 'dind');
      assert.deepEqual(create.ExposedPorts, { '4243/tcp': {} });
      assert.equal(create.Override, true);
    });
  });

  suite('#dockerStartConfig', function() {
    var subject = new GroupConifg({
      docker: {
        image: 'dind',
        startConfig: { Privileged: true }
      },
      amqp: { image: 'amqp' },

      app: {
        image: 'app',
        links: ['docker:docker', 'amqp:amqp']
      }
    });

    test('with overrides', function() {
      var links = {
        docker: 'container/docker',
        amqp: 'container/amqp'
      };

      var start = subject.dockerStartConfig(
        'app',
        links,
        { PublishAllPorts: true }
      );

      assert.deepEqual(start.Links, [
        links.docker + ':docker',
        links.amqp + ':amqp'
      ]);

      assert.ok(start.PublishAllPorts, 'overrides apply');
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
    var config = {
      app: { image: 'app', links: ['db:db', 'queue:queue'] },
      db: { image: 'db', links: ['monit:monit', 'xvfb:xvfb'] },
      queue: { image: 'queue', links: ['monit:monit', 'amqp:amqp'] },
      monit: { image: 'monit' },
      xvfb: { image: 'xvfb' },
      amqp: { image: 'amqp' }
    };

    var subject;
    setup(function() {
      subject = new GroupConifg(config);
    });

    function mapNamesToServices(order) {
      return order.map(function(group) {
        return group.map(function(service) {
          return subject.services[service];
        });
      });
    }

    test('a nested dep', function() {
      var order = [['monit', 'amqp', 'xvfb'], ['queue']];
      assert.deepEqual(
        mapNamesToServices(order),
        subject.dependencyGroups(['queue', 'xvfb'])
      );
    });

    test('all deps', function() {
      var order = [
        ['monit', 'xvfb', 'amqp'],
        ['db', 'queue'],
        ['app']
      ];

      assert.deepEqual(
        mapNamesToServices(order),
        subject.dependencyGroups()
      );
    });
  });
});
