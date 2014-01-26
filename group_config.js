var util = require('util');
var dependencyGroups = require('dependency-groups');

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

function linksToServices(links) {
  return links.map(function(link) {
    return link.split(':').shift();
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
function Service(name, object) {
  // copy all services into a normalized object
  return {
    name: name,
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
    services[service] = new Service(service, config);
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

  @param {Array} [roots] list of services to return results for.
  @return {Array} groups of dependencies.
  */
  dependencyGroups: function(roots) {
    var services = this.services;
    var relationships = {};

    // first map it into the data structure dependency-groups expects
    Object.keys(services).forEach(function(service) {
      var conifg = services[service];
      relationships[service] = linksToServices(conifg.links);
    });

    var serviceGrouping = dependencyGroups(relationships, roots);
    return serviceGrouping.map(function(group) {
      return group.map(function(serviceName) {
        if (!services[serviceName]) {
          throw new Error('unkown service ' + serviceName);
        }
        return services[serviceName];
      }, this);
    }, this);

  }
};

module.exports = GroupConfig;
