.PHONY: test_image
test_image:
	docker build -t docker_stack_run_test test_image

.PHONY: test
test:
	make -C associate test
	./node_modules/.bin/mocha $(wildcard *_test.js)
