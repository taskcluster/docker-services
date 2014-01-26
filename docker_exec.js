var EventEmitter = require('events').EventEmitter;
var streams = require('stream');
var debug = require('debug')('docker-services:exec');

function createDefaults(create) {
  var config = {
    Hostname: '',
    User: '',
    AttachStdin: false,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    OpenStdin: false,
    StdinOnce: false,
    Env: null,
    Volumes: {},
    VolumesFrom: ''
  };

  for (var key in create) config[key] = create[key];
  return config;
}

function startDefaults(start) {
  var config = {
    Binds: null,
    ContainerIDFile: '',
    LxcConf: [],
    Privileged: false,
    PortBindings: {},
    Links: [],
    PublishAllPorts: false
  };

  for (var key in start) config[key] = start[key];
  return config;
}

function splitStreams(run, container, stream) {
  var modem = container.modem;

  var stdout = new streams.PassThrough();
  var stderr = new streams.PassThrough();

  modem.demuxStream(stream, stdout, stderr);
  run.emit('streams', stdout, stderr);
}

function DockerRun(docker, config) {
  EventEmitter.call(this);

  this.docker = docker;
  this.create = createDefaults(config.create);
  this.start = startDefaults(config.start);
}

DockerRun.prototype = {
  __proto__: EventEmitter.prototype,

  /**
  Run the docker process and resolve the promise on complete.
  */
  exec: function() {
    debug('exec', this.create, this.start);

    var docker = this.docker;

    var attachConfig = {
      stream: true,
      stdout: true,
      stderr: true
    };

    var create = docker.createContainer(this.create);
    var container;

    return create.then(
      function onContainer(_container) {
        debug('created container', _container.id);
        container = docker.getContainer(_container.id);
        return container.attach(attachConfig);
      }.bind(this)
    ).then(
      function attachedContainer(stream) {
        debug('attached');
        splitStreams(this, container, stream);
        var start = container.start(this.start);
        return start;
      }.bind(this)
    ).then(
      function startedContainer() {
        debug('initiate wait for container');
        return container.wait();
      }
    );
  }
};

module.exports = DockerRun;
