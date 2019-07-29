# highload-stats ver. 0.2
Statistics server in real-time graphs.
![Preview](https://oxmix.net/storage/b/73/566c3e8588dc3.png)

## Install for Ubuntu/Debian
Execute in console
```bash
cd /home
git clone https://github.com/oxmix/highload-stats.git
sudo apt-get install nodejs npm ifstat iotop redis-cli
cd ./highload-stats/server && npm install ws
chmod +x restart.sh server.js
```

## Run 
* server in console `sudo ./server/restart.sh`
* open in browser `http://remote.host.io:3939`

## Debug 
* back-end - run console `./server/server.js debug`
* frond-end - `./web/external/common.js` => `debug: true`

## Proxy 
Example for proxy nginx >= 1.3.13
```
server {
    location /highload-stats/ {
	proxy_pass http://remote.host.io:3939;
	proxy_http_version 1.1;
	proxy_set_header Upgrade $http_upgrade;
	proxy_set_header Connection "upgrade";
    }
}
```