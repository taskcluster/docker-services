var Associate = require('./associate');
var GroupConfig = require('./group_config');
var Promise = require('promise');
var DockerExec = require('./docker_exec');

var debug = require('debug')('docker-service:group_containers');

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
  @param {Object} links map of available links.
  */
  _deamonize: function(name, links) {
    var service = this.groupConfig.services[name];
    var docker = this.docker;

    debug('start deamonize', name, service);

    var createConfig = { Image: service.image };
    var startConfig = { Links: [] };

    // check for links and build the link associations for this
    // container.
    service.links.forEach(function(item) {
      // we alias the names to services rather then running docker
      // containers so we need to transform the link based on what the
      // actual name is in docker.
      var linkParts = item.split(':');
      var linkServiceName = linkParts[0];
      var linkAliasName = linkParts[1];

      startConfig.Links.push(links[linkServiceName] + ':' + linkAliasName);
    });

    debug('deamonize', name, createConfig, startConfig);

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
      function(value) {
        // XXX: get the start config
        return containerInterface.start(startConfig);
      }
    ).then(
      function(value) {
        return id;
      }
    );
  },

  _launchGroupThunk: function(links, state, services) {
    // lazily evaluated (for promise chains)
    return function() {
      var promises = [];
      var docker = this.docker;

      services.forEach(function(service) {
        var name = service.name;
        // check to see if we have one running already
        var serviceState = state[name];
        var instance;

        if (
          serviceState &&
          (instance = serviceState[0]) &&
          instance.running
        ) {
          // XXX: always linking the first one is a good start but links
          //      don't extend much beyond 1:1 (with the possible
          //      exception of ambassadors)
          return links[name] = instance.name;
        }

        if (instance) {
          throw new Error('cannot process new starts of down images');
          return;
        }


        var promise = this._deamonize(name, links).then(
          function gotContainer(id) {
            return docker.getContainer(id).inspect();
          }
        ).then(
          function saveLink(result) {
            links[name] = result.Name;
          }
        );

        promises.push(promise);
      }, this);

      return Promise.all(promises);

    }.bind(this);
  },

  _up: function(dependencies) {
    if (!dependencies.length) return Promise.from(false);

    var links = {};

    // get the current state of the system.
    return this.inspectServices().then(
      function servicesRunning(state) {
        startingState = state;

        var group;
        var chain;
        var depth = 0;
        while ((group = dependencies.shift())) {
          depth++;
          var thunk = this._launchGroupThunk(links, state, group);
          if (!chain) {
            chain = thunk();
            continue;
          }
          chain = chain.then(thunk);
        }
        return chain;
      }.bind(this)
    );
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
