var util = require('util');
var ERRORS = {
  NO_IMAGE: '%s service is missing an image'
};

/**
Format an error based on its name and service.

@param {String} name (key) in ERRORS
@param {String} service that has the error.
@param {Object} config for the service.
*/
function error(name, service, config) {
  return {
    type: name,
    service: service,
    config: config,
    message: util.format(ERRORS[name], service)
  };
}

/**
Internal helper to format services (does not do validation).
*/
function Service(object) {
  // copy all services into a normalized object
  return {
    image: object.image || null,
    links: object.links || [],
    environment: object.environment || {},
    ports: object.ports || {}
  };
}

/**
Group config contains all the details about the services and how they relate.

This class also acts as a validator to prevent things like circular linking
etc..
*/
function GroupConfig(object) {
  // build a normalized list of services
  var services = this.services = {};

  Object.keys(object).forEach(function(service) {
    var config = object[service];
    services[service] = new Service(config);
  }, this);
}

GroupConfig.prototype = {

  /**
  Validate the group config and return the errors if found.

  @return {Array} return a list of errors.
  */
  errors: function() {
    var errors = [];
    Object.keys(this.services).forEach(function(service) {
      var config = this.services[service];

      if (!config.image) {
        errors.push(error('NO_IMAGE', service, config));
      }
    }, this);

    return errors;
  }
};

module.exports = GroupConfig;
