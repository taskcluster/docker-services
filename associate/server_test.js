suite('associate server', function() {
  var server = require('./');
  var request = require('supertest');

  suite('GET /services', function() {
    test('no containers', function(done) {
      request(server).
        get('/services').
        end(function(err, result) {
          assert.deepEqual(result.res.body, []);
          done(err);
        });
    });
  });

  suite('POST /containers', function() {
    var list = [
      { id: '1', service: 'foo' },
      { id: '2', service: 'foo' },
      { id: '3', service: 'baz' }
    ];

    setup(function(done) {
      request(server).
        post('/containers').
        send(list).
        end(done);
    });

    test('get services after post', function(done) {
      request(server).
        get('/services').
        end(function(err, result) {
          assert.deepEqual(result.res.body, {
            'foo': [list[0], list[1]],
            'baz': [list[2]]
          });
          done(err);
        });
    });

    suite('DELETE /container', function() {
      setup(function(done) {
        request(server).
          del('/container').
          send(['1', { id: 3 }]).
          end(done);
      });

      test('after delete', function(done) {
        request(server).
          get('/services').
          end(function(err, result) {
            assert.deepEqual(result.res.body, {
              'foo': [list[1]]
            });
            done(err);
          });
      });
    });
  });
});
