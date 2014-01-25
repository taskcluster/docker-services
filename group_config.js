var util = require('util');
var ERRORS = {
  NO_IMAGE: '%s service is missing an image',
  DUPLICATE_LINK: '%s service has duplicate link names'
};

function detectDuplicateLinks(service) {
  var links = service.links;
  var seen = {};

  return links.some(function(item) {
    if (seen[item]) return true;
    seen[item] = item;
    return false;
  });
}

/**
Basic duplicate link checking for now more checks in the future.
*/
function detectCircular(services, name) {
  var errors = [];
  var config = services[name];

  if (detectDuplicateLinks(config)) {
    errors.push(error('DUPLICATE_LINK', name, config));
    return errors;
  }

  return errors;
}

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
      var circular = detectCircular(this.services, service);
      if (circular.length) errors = errors.concat(circular);
    }, this);

    return errors;
  },

  /**
  Images may have nested dependencies build a list of the services and return
  them in the groups they can be launched in.

  @return {Array} groups of dependencies.
  */
  dependencyGroups: function(name) {
    var services = this.services;
    var result = [];

    function walkServices(names) {
      var group = [];
      // ghetto set
      var nextServices = {};

      names.forEach(function(name) {
        // add the config to stack
        var config = services[name];
        group.push(config);

        // find next batch of services to link
        config.links.forEach(function(link) {
          // service:alias docker link format
          var service = link.split(':').shift();
          nextServices[service] = true;
        });
      });

      // prepend this group
      result.unshift(group);

      // process the next group
      nextServices = Object.keys(nextServices);
      if (nextServices.length > 0) walkServices(nextServices);
    }

    walkServices([name]);
    return result;
  }
};

module.exports = GroupConfig;
