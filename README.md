# highload-stats ver. 0.1
Statistics server in real-time graphs.
![Preview](https://oxmix.net/storage/b/73/566c3e8588dc3.png)

## Install for Debian/Ubuntu
Execute in console
```bash
cd /home
git clone https://github.com/oxmix/highload-stats.git
sudo apt-get install nodejs npm ifstat iotop
cd ./highload-stats/server && npm install ws
chmod +x restart.sh server.js
```
Edit front-end config `nano ./web/external/config.js`
```js
var config = {
	host: 'remote.host.io',
	port: 3838,
	debug: false
};
```
For host `remote.host.io` looks at `./web`

Example for nginx `nano /etc/nginx/sites-available/highload-stats`
```
server {
	listen 80;
	server_name remote.host.io;
    root /home/highload-stats/web;
    index index.html;
}
```
## Run 
* server in console `./server/restart.sh`
* open in browser `http://remote.host.io`

## Integration for phpVirtualBox 5.0
* Open edit `phpvirtualbox/panes/tabVMDetails.html`
* Add string
```html
$('#vboxVMDetails').append('<iframe src="http://remote.host.io" allowtransparency frameborder="0" width="100%" height="800"></iframe>');
```
* Inside `$.when(vboxVMDataMediator.getVMDetails('host'))` after `__vboxDisplayHostDetailsData(d, targetDiv);`
```html
$.when(vboxVMDataMediator.getVMDetails('host')).done(function(d) {
	// Hide loading screen
	targetDiv.siblings().hide();
	targetDiv.show();
	__vboxDisplayHostDetailsData(d, targetDiv);
	
	$('#vboxVMDetails').append('<iframe src="http://remote.host.io" allowtransparency frameborder="0" width="100%" height="600"></iframe>');
	
});
```

## Debug 
* back-end - run console `./server/server.js debug`
* frond-end - edit config `./web/external/config.js` => `debug: true`