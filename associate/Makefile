VERSION=$(shell ../bin/docker_services --version)
.PHONY: build
build:
	docker build -t \
		taskcluster/docker-service-associate:$(VERSION) .

.PHONY: test
test: build
	docker run -i taskcluster/docker-service-associate:$(VERSION) npm test
	./node_modules/.bin/mocha test/integration_test.js
