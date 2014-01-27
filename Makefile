.PHONY: test_image
test_image:
	docker build -t docker_stack_run_test test_image

.PHONY: test
test:
	make -C associate test
	make -C examples/node_cmd
	make -C examples/node_server
	./node_modules/.bin/mocha $(wildcard *_test.js)
