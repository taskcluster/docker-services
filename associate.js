var IMAGE = 'taskcluster/docker-service-associate';
var IMAGE_TAG = require('./package.json').version;

var Promise = require('promise');
var dockerUtils = require('./docker_utils');

/**
Method decorator which will call up then call the given method if up is
successful. Method given must return a promise.
*/
function ensureUp(method) {
  return function autoUp() {
    var args = Array.prototype.slice.call(arguments);
    var context = this;
    return this.up().then(
      function handleUp() {
        return method.apply(context, args);
      }
    );
  }
}

/**
The associate is a named docker container that acts "grouping" mechanism for
other containers. With the associate we can lookup which containers belong to
what groups and services.

@param {Docker} docker interface.
@param {String} name docker name for the associate
*/
function Associate(docker, name, options) {
  options = options || {};

  this.name = name;
  this.docker = docker;
}

Associate.prototype = {
  /**
  The associate image name.
  */
  image: IMAGE,

  /**
  Ensure the associate image has been downloaded.

  @return Promise (will resolve as true if already installed).
  */
  _install: function() {
    return dockerUtils.ensureImage(this.docker, IMAGE);
  },

  /**
  Determine the api URL for the associate.
  */
  apiUrl: ensureUp(function() {
    var container = this.docker.getContainer(this.name);
    return container.inspect().then(
      function handleInspect(result) {
        var hostConfig = result.HostConfig;
        var ports = hostConfig.PortBindings['60044/tcp'][0];
        return 'http://' + ports.HostIp + ':' + ports.HostPort;
      }
    );
  }),

  /**
  Resolves with the container id if its up.
  */
  isUp: function() {
    return this.docker.getContainer(this.name).inspect().then(
      function onContainer(container) {
        return container.State.Running;
      },
      function containerReject(err) {
        // XXX: in reality we should check the error code
        return false;
      }
    );
  },

  /**
  Start and name a docker associate container.
  */
  _start: function() {
    var createConfig = {
      name: this.name,
      Image: IMAGE + ':' + IMAGE_TAG,
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      ExposedPorts: {
        '60044/tcp': {}
      }
    };

    var startConfig = {
      LxcConf: [],
      Privileged: false,
      PortBindings: {
        // find a new open port to bind to
        '60044/tcp': [{ HostIp: '', HostPort: '' }]
      },
      PublishAllPorts: false
    };

    // create the container
    var docker = this.docker;

    return docker.createContainer(createConfig).then(
      function containerCreated(_container) {
        container = docker.getContainer(_container.id);
        return container.start(startConfig);
      }
    );
  },

  /**
  Bring the associate up (if its not already online)
  */
  up: function() {
    return this.isUp().then(
      function isUpResult(container) {
        // if its running return the container
        if (container) {
          return container;
        }

        // otherwise start a new container
        return this._install().then(this._start.bind(this));
      }.bind(this)
    );
  },

  /**
  Turn the associate off if its not already off.
  */
  down: function() {
    return this.isUp().then(
      function(isUp) {
        if (!isUp) return false;
        return this.docker.getContainer(this.name).stop();
      }.bind(this)
    );
  },

  /**
  Remove the container.
  */
  delete: function() {
    var container = this.docker.getContainer(this.name);

    var existingContainer = function existingContainer() {
      return this.down().then(
        function removeContainer() {
          return container.remove();
        }
      );
    }.bind(this);

    return container.inspect().then(
      existingContainer,
      function missing() {
        return false;
      }
    );
  }
};

module.exports = Associate;
