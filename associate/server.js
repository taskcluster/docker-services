/**
The "associate" is an in memory db which stores information about the running
test services.

XXX: I could have used /etcd/ or redis to do most of this instead of a node
     module but there are some benefits to keeping the api strictly related to
     docker_services.
*/
var express = require('express'),
    app = express();

var Database = require('./database');

app.use(express.bodyParser());

// WTF - yes everything get stuffed here.
var database = new Database();

// add containers to the group
app.post('/containers', function addContainers(req, res) {
  var containers = req.body;
  containers.forEach(database.add, database);
  res.send(200);
});

app.get('/services', function getServices(req, res) {
  res.json(database.getServices());
});

/**
Normalize a container list into a flat array of ids.
*/
function normalizeContainers(array) {
  if (!array) return [];

  return array.map(function(item) {
    // usual case of just a string
    if (typeof item !== 'object') return item;

    // if its an object { id: '...' }
    if (item.id) return item.id;
  });
}

// deletes containers by their ids.
app.delete('/containers', function deleteConainter(req, res) {
  var list = normalizeContainers(req.body);
  list.forEach(database.remove, database);
  res.send(200);
});

if (require.main === module) {
  app.listen(60044);
}

module.exports = app;
