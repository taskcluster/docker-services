var Associate = require('./associate');
var GroupConfig = require('./group_config');
var Promise = require('promise');
var DockerProc = require('./docker_proc');

var debug = require('debug')('docker-service:group_containers');

function relateLinks(serviceLinks, linked) {
  var result = [];
  // check for links and build the link associations for this
  // container.
  serviceLinks.forEach(function(item) {
    // we alias the names to services rather then running docker
    // containers so we need to transform the link based on what the
    // actual name is in docker.
    var linkParts = item.split(':');
    var linkServiceName = linkParts[0];
    var linkAliasName = linkParts[1];

    result.push(linked[linkServiceName] + ':' + linkAliasName);
  });

  return result;
}

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
  Start a created container and link it.

  @param {Object} service associated with the container.
  @param {String} containerId docker container id.
  @param {Object} links current link mapping.
  */
  _start: function(service, containerId, links) {
    var startConfig = {
      Links: relateLinks(service.links, links)
    };

    return this.docker.getContainer(containerId).start(startConfig);
  },

  /**
  Start running a service as deamon background process.

  @param {String} name of the service.
  @param {Object} links map of available links.
  */
  _deamonize: function(name, links) {
    var service = this.groupConfig.services[name];
    var docker = this.docker;

    debug('deamonize', name, service);

    var createConfig = { Image: service.image };

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
        return this._start(service, id, links);
      }.bind(this)
    ).then(
      function() {
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

        if (serviceState && serviceState[0]) {
          var instance = serviceState[0];
          links[name] = instance.name;

          if (!instance.running) {
            // XXX: maybe this should throw as a link can be associated
            // with a down service and restarting might be a better idea.
            promises.push(this._start(service, instance.id, links));
          }

          // its running or we started it so move to the next item.
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
    ).then(
      function() { return links; }
    );
  },

  /**
  Resolve all dependencies for a given service (bring them up) and resolve with
  a DockerProc value which can be used to run the service and get its 
  stdout/stderr.

  @return Promise
  */
  spawn: function(name, cmd, options) {
    var deps = this.groupConfig.dependencyGroups([name]);
    var service = this.groupConfig.services[name];

    // remove the root node
    deps.pop();

    // XXX: add more options
    var createConfig = {
      Image: service.image,
      Cmd: cmd || null
    };

    var startConfig = {};

    return this._up(deps).then(
      function(links) {
        startConfig.Links = relateLinks(service.links, links);
        return new DockerProc(this.docker, {
          start: startConfig,
          create: createConfig
        });
      }.bind(this)
    );
  },

  /**
  Run a status check on all services in this group.

    // value looks like this
    {
      worker: [{ name: '/docker_name', id: 'woot', running: true }],
     ...
    }

  @return {Promise}
  */
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
