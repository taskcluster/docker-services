var Associate = require('./associate');
var GroupConfig = require('./group_config');
var Promise = require('promise');
var DockerExec = require('./docker_exec');

/**
@param {Dockerode} docker api.
@param {Object} groupConfig for containers.
@param {String} name for container group.
*/
function GroupContainers(docker, groupConfig, name) {
  this.docker = docker;
  this.name = name;

  this.groupConfig = new GroupConfig(groupConfig);
  this.associate = new Associate(docker, name);
}

GroupContainers.prototype = {

  /**
  Docker wrapper around stop (mostly here for consistency)
  */
  _stop: function(containerId) {
    var containerInterface = this.docker.getContainer(containerId);
    return containerInterface.stop();
  },

  /**
  Remove a particular instance of an node (again for consistency)
  */
  _remove: function(containerId) {
    return this._stop(containerId).then(
      function stopped() {
        var containerInterface = this.docker.getContainer(containerId);
        return containerInterface.remove();
      }.bind(this)
    );
  },

  /**
  Start running a service as deamon background process.

  @param {String} name of the service.
  */
  _deamonize: function(name) {
    var service = this.groupConfig.services[name];
    var docker = this.docker;
    var createConfig = {
      Image: service.image
    };

    var containerInterface;
    var id;
    return docker.createContainer(createConfig).then(
      function onCreate(container) {
        id = container.id;
        containerInterface = docker.getContainer(id);

        // add the container before we start
        return this.associate.addContainer(id, name);
      }.bind(this)
    ).then(
      function() {
        // XXX: get the start config
        return containerInterface.start({});
      }
    ).then(
      function() {
        return id;
      }
    );
  },

  _up: function(dependencies) {
  },

  inspectServices: function() {
    var docker = this.docker;

    function mapServiceToContainer(list) {
      return list.map(function(service) {
        var container = docker.getContainer(service.id);
        return container.inspect().then(
          function available(result) {
            service.running = result.State.Running;
            service.name = result.Name;
            // docker uses id, Id AND ID
            service.id = result.ID;
            service.inspection = result;
          }
          // XXX: we need to handle containers which have been removed
        );
      });
    }

    return this.associate.getServices().then(
      function services(services) {
        var promises = [];
        for (var key in services) {
          promises = promises.concat(mapServiceToContainer(services[key]));
        }

        return Promise.all(promises).then(
          function() { return services; }
        );
      }
    );
  }
};

module.exports = GroupContainers;
