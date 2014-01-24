from lightsofapollo/node:0.10.24
maintainer James Lal <jlal@mozilla.com>
env HOME /home/docker_associate
run useradd docker_associate --create-home
add . /home/docker_associate/app
run chown -R docker_associate:docker_associate /home/docker_associate/
USER docker_associate
workdir /home/docker_associate/app
run npm install
expose 60044
# USE CMD not entrypoint so its easy to override
cmd ["npm", "start"]
