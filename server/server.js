#!/usr/bin/env nodejs

var port = 3939;

process.title = 'highload-stats';

var debug = process.argv[2] == 'debug';

var crypto = require('crypto'),
	wss = require('ws'),
	exec = require('child_process').exec,
	spawn = require('child_process').spawn,
	fs = require('fs'),
	http = require('http');

var app = http.createServer(function (req, res) {
	var file = 'index.html';
	req.url = req.url.replace('/highload-stats', '');
	if (req.url == '/jquery.js') {
		file = 'jquery.js';
	}
	if (req.url == '/highcharts.js') {
		file = 'highcharts.js';
	}
	if (req.url == '/common.js') {
		file = 'common.js';
	}
	if (req.url == '/common.css') {
		file = 'common.css';
	}

	 if (file != '') {
		fs.readFile(__dirname + '/../web/' + file, 'utf8', function (err, data) {
			if (err) {
				res.writeHead(404);
				res.end("404 - This is highLoad-stats!\n");
				if (debug)
					return console.log(err);
			}
			res.writeHead(200);
			res.end(data);
		});
	} else {
		res.writeHead(200);
		res.end("This is highLoad-stats!\n");
	}
}).listen(port);

// clients
var connection = {};

// server
var webSocketServer = new wss.Server({server: app});
webSocketServer.on('connection', function (ws) {
	var id = crypto.createHash('md5').update(Math.random() + '.' + (new Date).getTime()).digest('hex');

	log('info', 'open – ' + id);

	if (!connection[id]) {
		connection[id] = {
			socket: ws,
			time: {
				ping: (new Date).getTime(),
				pong: (new Date).getTime(),
				lastSend: 0
			},
			info: {
				ip: ws._socket.remoteAddress,
				timeCreate: (new Date).getTime()
			}
		};

		send({id: id}, id);

		sendActiveConnection();
	}

	ws.on('message', function (json) {

		try {
			var obj = JSON.parse(json);
		} catch (e) {
			return log('error', 'JSON parse error - ' + e);
		}

		if (!obj || !connection[obj.id])
			return;

		log('msg', obj.id + ' - ' + json);

		if (obj.command == 'ping')
			send({
				data: {
					event: 'pong',
					time: obj.time
				}
			}, obj.id);

		if (obj.command == 'everyone')
			send({
				data: {
					event: obj.command,
					data: obj.data
				},
				id: obj.id
			});

		if (obj.command == 'to')
			send({
				data: {
					event: obj.command,
					data: obj.data
				},
				id: obj.id
			}, obj.id);

		if (obj.command == 'stats') {
			send({
				data: {
					event: obj.command,
					mem: process.memoryUsage()
				},
				id: obj.id
			}, obj.id);
		}

	});

	ws.on('close', function () {
		if (connection[id]) {
			if (typeof connection[id].socket != 'undefined')
				connection[id].socket.terminate();
			delete connection[id];
		}
		sendActiveConnection();
		log('info', 'close – ' + id);
	});

	ws.on('pong', function (key, options, dontFailWhenClosed) {
		if (connection[key])
			connection[key].time.pong = (new Date).getTime();
	});

	ws.on('disconnect', function () {
		log('warn', 'ws disconnecting');
	});

	ws.on('error', function (error) {
		log('error', 'ws.error => ' + error);
	});
});

log('info', 'сервер запущен, порт ' + port + ' / pid ' + process.pid);

var sendActiveConnection = function (from) {
	var online = {},
		quantityConnection = 0;

	for (var key in connection) {
		quantityConnection++;

		if (!online[connection[key].info.ip])
			online[connection[key].info.ip] = 0;
		online[connection[key].info.ip]++;
	}

	var quantityOnline = Object.keys(online).length;
	send({
		data: {
			event: 'quantity',
			quantityConnection: quantityConnection,
			quantityOnline: quantityOnline
		}
	}, (from || null));
};

var send = function (object, from) {
	if (from) {
		object.id = from;

		if (typeof connection[from] != 'undefined') {
			if (connection[from].socket.readyState != 1)
				return;

			connection[from].time.lastSend = (new Date).getTime();
			connection[from].socket.send(JSON.stringify(object));
		}
	} else {
		for (var key in connection) {
			object.id = key;

			if (connection[key].socket.readyState != 1)
				continue;

			connection[key].time.lastSend = (new Date).getTime();
			connection[key].socket.send(JSON.stringify(object));
		}
	}
};

// ping
setInterval(function () {
	var quantityPing = 0;
	for (var key in connection) {
		if (connection[key].socket.readyState != 1)
			continue;

		if (connection[key].time.pong < (new Date).getTime() - 30 * 1000) {
			connection[key].socket.terminate();
			delete connection[key];
			sendActiveConnection();
			log('warn', 'close timeout – ' + key);
		}

		if (connection[key]) {
			quantityPing++;
			connection[key].socket.ping(key);
			connection[key].time.ping = (new Date).getTime();
		}
	}

	log('debug', 'quantity sent ping: ' + quantityPing);

}, 15000);

/**
 * Print info memory usage process
 */
(function () {
	if (!debug)
		return;

	setInterval(function () {
		var infoMem = '';

		var pmu = process.memoryUsage();
		for (var s in pmu) {
			infoMem += ' / ' + s + ': ' + Math.round(pmu[s] / 1024) + 'kb';
		}

		log('debug', 'info memory usage: ' + infoMem);
	}, 10000);
}());

// bandwidth stats in/out kbps
exec("ip route ls 2>&1 | grep default | awk '{print $5}'", function (error, stdout, stderr) {
	var bandwidth = spawn('ifstat', ['-i', stdout.trim(), '-b']);
	bandwidth.stdout.on('data', function (data) {
		var bw = data.toString().match(/([0-9.]+)   ([0-9.]+)/g);
		send({
			data: {
				event: 'bandwidth',
				in: bw[0],
				out: bw[1]
			}
		});
	});
});

// IO disk stats read/write kBps
var iotop = spawn('iotop', ['-k', '-q', '-o', '-d 1']);
iotop.stdout.on('data', function (data) {
	data = data.toString();
	var r = data.match(/Actual DISK READ.*?([0-9]+.[0-9]+)/),
		w = data.match(/Actual DISK WRITE.*?([0-9]+.[0-9]+)/);

	if (!r || !w)
		return;
	send({
		data: {
			event: 'io-disk',
			read: Math.round(r[1] * 1024),
			write: Math.round(w[1] * 1024)
		}
	});
});

// memory
var memory = spawn('free', ['-b', '-s 1', '-o']);
memory.stdout.on('data', function (data) {
	var mem = data.toString().match(/([0-9]+)/g);
	send({
		data: {
			event: 'memory',
			totalRam: mem[0],
			ram: [
				{
					name: 'used',
					y: (mem[1] * 100 / mem[0]),
					size: (mem[1] / 1024 / 1024).toFixed(2)
				}, {
					name: 'free',
					y: (mem[2] * 100 / mem[0]),
					size: (mem[2] / 1024 / 1024).toFixed(2)
				}, {
					name: 'shared',
					y: (mem[3] * 100 / mem[0]),
					size: (mem[3] / 1024 / 1024).toFixed(2)
				}, {
					name: 'buffers',
					y: (mem[4] * 100 / mem[0]),
					size: (mem[4] / 1024 / 1024).toFixed(2)
				}, {
					name: 'cached',
					y: (mem[5] * 100 / mem[0]),
					size: (mem[5] / 1024 / 1024).toFixed(2)
				}
			],
			totalSwap: mem[6],
			swap: [
				{
					name: 'used',
					y: (mem[7] * 100 / mem[6]),
					size: (mem[7] / 1024 / 1024).toFixed(2)
				}, {
					name: 'free',
					y: (mem[8] * 100 / mem[6]),
					size: (mem[8] / 1024 / 1024).toFixed(2)
				}
			]
		}
	});
});

// cpu cores stat
var cpuPrev = {};
var cpusLoad = {};
setInterval(function () {
	exec('cat /proc/stat', function (error, stdout, stderr) {
		stdout.match(/(cpu\d+).+/g).forEach(function (cpu, num) {
			num = ++num;
			cpu = cpu.split(' ');

			if (!cpuPrev[num])
				cpuPrev[num] = {};

			var idle = cpu[4];
			var total = 0;
			cpu.forEach(function (e) {
				if (+e > 0)
					total += +e;
			});

			diffIdle = idle - (cpuPrev[num].idle || 0);
			diffTotal = total - (cpuPrev[num].total || 0);

			cpuPrev[num].idle = idle;
			cpuPrev[num].total = total;

			cpusLoad[num] = Math.floor((1000 * (diffTotal - diffIdle) / diffTotal + 5) / 10);
		});
	});
	send({
		data: {
			event: 'cpu',
			list: cpusLoad
		}
	});
}, 1000);

// space
setInterval(function () {
	var space = spawn('df', ['-m', '--total']);
	space.stdout.on('data', function (data) {
		var space = data.toString().match(/total.*?([0-9]+).*?([0-9]+).*?([0-9]+)/);
		send({
			data: {
				event: 'space',
				total: space[1],
				space: [
					{
						name: 'used',
						y: (space[2] * 100 / space[1]),
						size: (space[2] / 1024).toFixed(2)
					}, {
						name: 'free',
						y: (space[3] * 100 / space[1]),
						size: (space[3] / 1024).toFixed(2)
					}
				]
			}
		});
	});
}, 1000);

/**
 * Other functions
 */

function log(type, msg) {
	if (!debug)
		return;

	var color = '\u001b[0m',
		reset = '\u001b[0m';

	switch (type) {
		case "info":
			color = '\u001b[36m';
			break;
		case "warn":
			color = '\u001b[33m';
			break;
		case "error":
			color = '\u001b[31m';
			break;
		case "msg":
			color = '\u001b[34m';
			break;
		case 'debug':
			color = '\u001B[37m'; // 35 || 37
			break;
		default:
			color = '\u001b[0m'
	}

	console.log(color + ' ' + type + reset + ' – ' + msg + ' – ' + (new Date()).toString());
}

if (!Object.keys) {
	Object.keys = function (obj) {
		var keys = [],
			k;
		for (k in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, k)) {
				keys.push(k);
			}
		}
		return keys;
	};
}