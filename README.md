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
