var Promise = require('promise');
var debug = require('debug')('docker_service:docker_utils');
var debugImage = require('debug')('docker_service:docker_utils_image');

function wrapStream(stream) {
  return new Promise(function(accept, reject) {
    var code = stream.statusCode;
    if (code < 200 || code > 299) {
      debug('failed to pull', code);
      return reject(new Error('failed to pull image:' + image));
    }

    if (debugImage.enabled) {
      stream.on('data', function(packet) {
        var data = JSON.parse(packet);
        if (!data.id) return debugImage(data.status);
        debugImage(data.id, data.status, data.progress || '');
      });
    }

    stream.resume();
    stream.once('end', accept);
    stream.once('error', reject);
  });
}

/**
Pull an image from the docker index (and deal with th the output)
*/
function pullImage(docker, image) {
  debug('pull', image);
  return docker.pull(image).then(wrapStream);
}
module.exports.pullImage = pullImage;

function removeImageIfExists(docker, image) {
  debug('remove', image);
  return new Promise(function(accept, reject) {
    // delete the image but ignore 404 errors
    docker.getImage(image).remove().then(
      function removed(list) {
        debug('removed', image, list);
        accept();
      },
      function removeError(err) {
        // XXX: https://github.com/apocas/docker-modem/issues/9
        if (err.message.indexOf('404') !== -1) return accept();
        reject(err);
      }
    );
  });
}

module.exports.removeImageIfExists = removeImageIfExists;

function ensureImage(docker, image) {
  // first attempt to find the image locally...
  return docker.getImage(image).inspect().then(
    function inspection(gotImg) {
      console.log(image, gotImg);
      // false means we didn't pull
      return false;
    },

    function missingImage() {
      // image is missing so pull it
      return pullImage(docker, image).then(function() {
        // indicate that we pulled a fresh image.
        return true;
      });
    }
  );
}
module.exports.ensureImage = ensureImage;
