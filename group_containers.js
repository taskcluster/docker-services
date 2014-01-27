var Associate = require('./associate');
var GroupConfig = require('./group_config');
var Promise = require('promise');
var DockerProc = require('./docker_proc');

var debug = require('debug')('docker-service:group_containers');

/**
Trim down the services returned by inspect services to only those in the allowed
parameter (or just return everything if nothing is in allowed).
*/
function trimServices(inspectResult, allowed) {
  if (!allowed) return inspectResult;

  var results = {};

  allowed.forEach(function(name) {
    if (!inspectResult[name]) return;
    results[name] = inspectResult[name];
  });
}

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
    debug('stop container', containerId);
    var containerInterface = this.docker.getContainer(containerId);
    return containerInterface.stop();
  },

  /**
  Remove a particular instance of an node (again for consistency)
  */
  _remove: function(containerId) {
    debug('remove container', containerId);
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
    debug('start container', containerId);
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
  Launch services and their dependencies.

  @param {Array} [services] optional list of services to launch.
  @return {Promise}
  */
  up: function(services) {
    debug('up');
    var deps = this.groupConfig.dependencyGroups(services);
    return this._up(deps);
  },

  /**
  Invoke a method on all services which have containers.
  */
  _invokeContainerMethod: function(method) {
    var actioned = [];
    return this.inspectServices().then(
      function onCurrentServices(currentServices) {
        var promises = [];

        for (var name in currentServices) {
          currentServices[name].forEach(function(service) {
            var promise = method(service);
            if (promise) {
              actioned.push(service);
              promises.push(promise);
            }
          }, this);
        }
        return Promise.all(promises);
      }.bind(this)
    ).then(
      function() { return actioned; }
    );
  },

  /**
  Return off services and their dependencies.

  XXX: this should allow selective grouping of services.

  @return {Promise}
  */
  down: function() {
    debug('down');
    return this._invokeContainerMethod(function(service) {
      if (service.running) {
        return this._stop(service.id);
      }
    }.bind(this));
  },

  /**
  Remove services and their dependencies.

  XXX: This should allow selective grouping of services.

  @return {Promise}
  */
  remove: function() {
    debug('remove');
    return this._invokeContainerMethod(function(service) {
      return this._remove(service.id);
    }.bind(this));
  },

  /**
  Resolve all dependencies for a given service (bring them up) and resolve with
  a DockerProc value which can be used to run the service and get its
  stdout/stderr.

  @return {Promise}
  */
  spawn: function(name, cmd, options) {
    debug('spawn', name, cmd);
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
    var associate = this.associate;
    var result;

    function mapServiceToContainer(list) {
      return list.map(function(serviceNode) {
        var container = docker.getContainer(serviceNode.id);
        return container.inspect().then(
          function available(result) {
            serviceNode.running = result.State.Running;
            serviceNode.name = result.Name;
            // docker uses id, Id AND ID
            serviceNode.id = result.ID;
            serviceNode.inspection = result;
          },
          function missingContainer(err) {
            if (err.message.indexOf('404') === -1) throw err;
            debug(
              'removing missing service node',
              serviceNode.service,
              serviceNode.id
            );

            // remove the service from the in memory list
            var idx = list.indexOf(serviceNode);
            if (idx !== -1) {
              list.splice(idx, 1);

              // remove the whole service if it has zero nodes
              if (!result[serviceNode.service].length) {
                delete result[serviceNode.service];
              }
            }

            // also remove it from the associate
            return associate.removeContainer(serviceNode.id);
          }.bind(this)
        );
      });
    }

    return this.associate.getServices().then(
      function services(services) {
        result = services;

        var promises = [];
        for (var key in result) {
          promises = promises.concat(mapServiceToContainer(result[key]));
        }

        return Promise.all(promises).then(
          function() {
            return result;
          }
        );
      }
    );
  }
};

module.exports = GroupContainers;
