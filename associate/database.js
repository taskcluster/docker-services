function Database() {
  this.containers = {};
}

Database.prototype = {
  /**
  Add a container to the database
  */
  add: function(container) {
    this.containers[container.id] = container;
  },

  /**
  Remove a container from the database
  */
  remove: function(id) {
    return delete this.containers[id];
  },

  /**
  Return all containers grouped by services
    {
      worker: [component, component, ...]
    }
  */
  getServices: function() {
    var result = {};
    Object.keys(this.containers).forEach(function(key) {
      var container = this.containers[key];
      if (!result[container.service]) {
        result[container.service] = [];
      }
      result[container.service].push(container);
    }, this);
    return result;
  }
};

module.exports = Database;
