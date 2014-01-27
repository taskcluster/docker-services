# docker-services

Docker orchestration library (written in node) for testing
docker images. Images can depend on other images, etc...

## Examples

Lets say you have a node application which has a worker and uses both
use amqp.

`docker_services.json:`

```json
{
  "app": {
    "links": ["worker:worker", "amqp:amqp"],
    "image": "my-repo/my-app"
  },

  "worker": {
    "links": ["amqp:amqp"],
    "image": "my-repo/worker"
  },

  "amqp": {
    "image": "some-lib/amqp"
  }
}

```

Then you could run a test on in the app like this:

```sh
docker-services exec app npm test
```

## Developing

You need [vagrant](http://www.vagrantup.com/).

### Running the tests

```sh
vagrant up
vagrant ssh
cd /vagrant
make test
```

### Publishing a new version

The 'associate' is a docker image that also needs to be published
for each version (right now this is tied to my docker account).
