VERSION=$(shell ../bin/docker-services version)
.PHONY: build
build:
	docker build -t \
		lightsofapollo/docker-service-associate:$(VERSION) .

.PHONY: test
test: build
	docker run -i lightsofapollo/docker-service-associate:$(VERSION) npm test
	./node_modules/.bin/mocha test/integration_test.js
