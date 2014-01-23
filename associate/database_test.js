suite('database', function() {
  var Database = require('./database');

  var db;
  setup(function() {
    db = new Database();
  });

  test('#getServices - no components', function() {
    assert.deepEqual(db.getServices(), {});
  });

  suite('#add', function() {
    test('add then get services', function() {
      var components = [
        { id: '1', service: 'worker'},
        { id: '2', service: 'worker'}
      ];

      components.forEach(db.add, db);

      assert.deepEqual(
        db.getServices(),
        { 'worker': components }
      );
    });
  });

  suite('#remove', function() {
    test('one left after remove', function() {
      var components = [
        { id: '1', service: 'worker'},
        { id: '2', service: 'worker'}
      ];

      components.forEach(db.add, db);
      db.remove('1');


      assert.deepEqual(
        db.getServices(),
        { 'worker': [components[1]]}
      );
    });
  });
});
