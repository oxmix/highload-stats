# highload-stats 0.1
Stats server real time in graphics, for native, phpvirtualbox or etc.
![Main frame image](https://oxmix.net/storage/b/73/566c3e8588dc3.png)

## Install for Debian/Ubuntu
Execute in console
```bash
git clone https://github.com/oxmix/highload-stats.git
sudo apt-get install nodejs npm ifstat iotop
cd ./highload-stats/server && npm install ws
chmod +x restart.sh server.js
```
Edit config file `./web/external/config.js`
```js
var config = {
	host: 'remote.host.io',
	port: 3838,
	debug: false
};
```

### Run `./restart.sh`
### Run debug `./server.js debug`