# highload-stats
[![CI Status](https://github.com/oxmix/highload-stats/workflows/Build%20and%20publish/badge.svg)](https://github.com/oxmix/hgls-collector/actions/workflows/hub-docker.yaml)
[![Docker Pulls](https://img.shields.io/docker/pulls/oxmix/highload-stats.svg?logo=docker)](https://hub.docker.com/r/tonistiigi/binfmt/)

HGLS Statistics – stats on servers in real-time graphs and history, easy and powerful.

![Preview](web/preview/v2.png)

## Run docker container
* Execute in the console
```bash
$ docker run -d --name highload-stats \
  --restart always --log-opt max-size=5m \
  -v /var/lib/hgls:/app/db \
  -p 127.0.0.1:8039:8039 \
  -p 127.0.0.1:3939:3939 \
oxmix/highload-stats:2
```
* open in browser [`http://127.0.0.1:8039`](http://127.0.0.1:8039) or [`http://remote.host.io:8039`](http://remote.host.io:8039)

## Required
* Don't forget open firewall port 3939 for connection hgls-collectors
* Or settings proxy through nginx

## Install hgls-collector
* Install and run collector for each server [https://github.com/oxmix/hgls-collector](https://github.com/oxmix/hgls-collector)

### If you need get telemetry
* open in browser or curl `http://127.0.0.1:8039/telemetry`

### Settings proxy
Example for proxy nginx >= 1.3.13
```nginx
server {
    listen 80;
    server_name remote.host.io;
    
    location / {
        proxy_pass http://127.0.0.1:8039;
        proxy_http_version 1.1;
        proxy_read_timeout 200s;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /collector {
        proxy_pass http://127.0.0.1:3939;
        proxy_http_version 1.1;
        proxy_read_timeout 200s;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Run without container
* in console `$ npm i` and `$ ./index.js start` maybe also `stop|restart|debug`
* open in browser [`http://127.0.0.1:8039`](http://127.0.0.1:8039) or [`http://remote.host.io:8039`](http://remote.host.io:8039)

### Deployment manifest for [container-ship](https://github.com/oxmix/container-ship)
```yaml
space: hgls
name: highload-stats-deployment
nodes:
  - localhost
containers:
  - name: highload-stats
    from: oxmix/highload-stats:2
    restart: always
    log-opt: max-size=5m
    ports:
      - 127.0.0.1:8039:8039
      - 127.0.0.1:3939:3939
    volumes:
      - /var/lib/hgls:/app/db
```