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

  @return Promise
  */
  install: function() {
    return dockerUtils.ensureImage(this.docker, IMAGE);
  }
};

module.exports = Associate;
