var IMAGE = 'taskcluster/docker-service-associate';
var IMAGE_TAG = require('./package.json').version;

var Promise = require('promise');
var dockerUtils = require('./docker_utils');

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
    var config = {
      name: this.name,
      Image: IMAGE + ':' + IMAGE_TAG,
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      ExposedPorts: {
        '60044/tcp': {}
      }
    };

    // create the container
    var docker = this.docker;

    return docker.createContainer(config).then(
      function containerCreated(_container) {
        container = docker.getContainer(_container.id);
        return container.start();
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
  }
};

module.exports = Associate;
