#!/usr/bin/env bash

if [[ ! -f "./server/config.js" ]]; then
  cp ./server/config.default.js ./server/config.js
fi

chmod +x ./systemd.sh
chmod +x ./server/index.js

curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash - \
  && sudo apt-get -y update \
  && sudo apt-get install nodejs php-cli

cd ./server && npm i