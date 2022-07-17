FROM node:16.16-alpine
MAINTAINER Oxmix <oxmix@me.com>

WORKDIR /app
COPY /server ./server
COPY /web ./web

RUN apk --no-cache add php-cli && mkdir db && cd server; chmod +x index.js; npm i

EXPOSE 8039
EXPOSE 3939

ENTRYPOINT /app/server/index.js 2>&1