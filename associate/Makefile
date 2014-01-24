.PHONY: build
build:
	docker build -t \
		taskcluster/docker-service-associate:$(shell ../bin/docker_services --version) .

.PHONY: test
test: build
	docker run -i taskcluster/docker-service-associate npm test
