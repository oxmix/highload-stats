#!/usr/bin/env nodejs

var port = 3939,
	processName = 'highload-stats';

var crypto = require('crypto'),
	wss = require('ws'),
	exec = require('child_process').exec,
	spawn = require('child_process').spawn,
	fs = require('fs'),
	http = require('http');

var debug = null;
switch (process.argv[2]) {
	case 'start':
		console.log('Start hgls');
		exec(__dirname + '/server.js error > ' + __dirname + '/hgls-error.log 2>&1 &');
		return;

	case 'stop':
		console.log('Kill hgls');
		exec('killall ' + processName);
		return;

	case 'restart':
		console.log('Restart hgls');
		exec('killall ' + processName);
		exec(__dirname + '/server.js error > ' + __dirname + '/hgls-error.log 2>&1 &');
		return;

	case 'debug':
	case 'info':
	case 'warn':
	case 'error':
		debug = process.argv[2];
		break;
}

process.title = processName;

var accessKey = '';
try {
	var accessFile = __dirname + '/.access-key';
	if (fs.existsSync(accessFile)) {
		fs.readFile(accessFile, 'utf8', function (err, data) {
			log('info', '[access] key detected');
			accessKey = data.trim();
		})
	}
} catch (err) {
}

var app = http.createServer(function (req, res) {
	if (accessKey.length > 0 && req.url.indexOf(accessKey) === -1) {
		res.writeHead(403);
		res.end('highload-stats: 403');
		log('warn', '[web] 403: check access key');
		return;
	}

	var location;
	if (accessKey.length > 0) {
		location = '/highload-stats/' + accessKey + '/';
		req.url = req.url.replace('/highload-stats/' + accessKey, '');
	} else {
		location = '/highload-stats/';
		req.url = req.url.replace('/highload-stats', '');
	}

	if (!req.url.length) {
		res.writeHead(301, {Location: location});
		return res.end();
	}

	var routers = {
		'/': 'web/index.html',
		'/history': 'web/history.html',
		'/jquery.js': 'web/jquery.js',
		'/highcharts.js': 'web/highcharts.js',
		'/common.js': 'web/common.js',
		'/history.js': 'web/history.js',
		'/common.css': 'web/common.css',
		'/telemetry': function () {
			var tel = telemetry();
			return Object.keys(tel).map(function (k) {
				return tel[k]
			}).join('--/separator/--');
		},
		'/history.db': 'server/history.db'
	};

	if (!(req.url in routers)) {
		res.writeHead(404);
		res.end('highload-stats: 404');
		return;
	}

	var action = routers[req.url];
	if (typeof action !== 'function')
		log('info', '[web] router action: ' + action);

	if (typeof action === 'function') {
		res.writeHead(200);
		res.end(action());
		return;
	}

	fs.readFile(__dirname + '/../' + action, 'utf8', function (err, data) {
		if (err) {
			res.writeHead(404);
			res.end('highload-stats: 404');
			log('warn', '[web] 404: ' + err);
			return;
		}
		res.writeHead(200);
		res.end(data);
	});

}).listen(port);

// clients
var connection = {};

// server
var webSocketServer = new wss.Server({server: app});
webSocketServer.on('connection', function (ws) {
	var id = crypto.createHash('md5').update(Math.random() + '.' + (new Date).getTime()).digest('hex');

	log('info', '[ws] new connect, id: ' + id);

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
			return log('error', '[ws] json parse error: ' + e);
		}

		if (!obj || !connection[obj.id])
			return;

		log('info', '[ws] message: ' + json);

		if (obj.command === 'ping')
			send({
				data: {
					event: 'pong',
					time: obj.time
				}
			}, obj.id);

		if (obj.command === 'everyone')
			send({
				data: {
					event: obj.command,
					data: obj.data
				},
				id: obj.id
			});

		if (obj.command === 'to')
			send({
				data: {
					event: obj.command,
					data: obj.data
				},
				id: obj.id
			}, obj.id);

		if (obj.command === 'stats') {
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
		log('info', '[ws] close id: ' + id);
	});

	ws.on('pong', function (key) {
		if (connection[key])
			connection[key].time.pong = (new Date).getTime();
	});

	ws.on('disconnect', function () {
		log('warn', '[ws] disconnecting');
	});

	ws.on('error', function (error) {
		log('error', '[ws] error: ' + error);
	});
});

log('info', '[ws] server start, port: ' + port + ' pid: ' + process.pid);

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
	var time = (new Date).getTime();
	var string = JSON.stringify(object);

	if (from) {
		object.id = from;

		if (typeof connection[from] != 'undefined') {
			if (connection[from].socket.readyState !== 1)
				return;

			connection[from].time.lastSend = time;
			connection[from].socket.send(string);
		}
	} else {
		for (var key in connection) {
			object.id = key;

			if (connection[key].socket.readyState !== 1)
				continue;

			connection[key].time.lastSend = time;
			connection[key].socket.send(string);
		}
	}
};

// ping
setInterval(function () {
	var quantityPing = 0;
	for (var key in connection) {
		if (connection[key].socket.readyState !== 1)
			continue;

		if (connection[key].time.pong < (new Date).getTime() - 30 * 1000) {
			connection[key].socket.terminate();
			delete connection[key];
			sendActiveConnection();
			log('warn', '[ws] close timeout, id: ' + key);
		}

		if (connection[key]) {
			quantityPing++;
			connection[key].socket.ping(key);
			connection[key].time.ping = (new Date).getTime();
		}
	}

	log('info', '[hgls] quantity sent ping: ' + quantityPing);

}, 15000);

/**
 * Print info memory usage process
 */
(function () {
	if (!debug)
		return;

	setInterval(function () {
		var infoMem = [];

		var pmu = process.memoryUsage();
		for (var s in pmu) {
			infoMem.push(s + ': ' + Math.round(pmu[s] / 1024) + 'Kb');
		}

		log('info', '[hgls] memory usage ' + infoMem.join(' / '));
	}, 10000);
}());

// bandwidth stats in/out kbps
exec("ip route ls 2>&1 | grep default | awk '{print $5}'", function (error, stdout, stderr) {
	var bandwidth = spawn('ifstat', ['-i', stdout.trim(), '-b']);
	bandwidth.stdout.on('data', function (data) {
		var bw = data.toString().match(/([0-9.]+).*?([0-9.]+)\n/);
		send({
			data: {
				event: 'bandwidth',
				charts: [
					{
						name: 'in',
						val: bw[1]
					}, {
						name: 'out',
						val: bw[2]
					}
				]
			}
		});

		historySave('bandwidth', [bw[1], bw[2]]);
	});
});

// IO disk stats read/write kBps
var iotop = spawn('iotop', ['-k', '-q', '-o', '-d 1']);
iotop.stdout.on('data', function (data) {
	data = data.toString();
	var r = data.match(/Actual DISK READ.*?([0-9]+.[0-9]+)/),
		w = data.match(/Actual DISK WRITE.*?([0-9]+.[0-9]+)/),
		io = data.match(/%.*([0-9.]+).*%/g);

	var ioPer = 0;
	if (io) {
		ioPer = io.map(function (val) {
			return val.replace(/ /g, '').replace(/%/g, '');
		}).reduce(function (acc, val) {
			return parseFloat(acc) + parseFloat(val);
		}, 0);
	}

	var read = r ? Math.round(r[1] * 1024) : 0;
	var write = w ? Math.round(w[1] * 1024) : 0;

	send({
		data: {
			event: 'io-disk',
			io: ioPer,
			charts: [
				{
					name: 'read',
					val: read
				}, {
					name: 'write',
					val: write
				}
			]
		}
	});

	historySave('io-disk', [read, write, ioPer]);
});

// memory
setInterval(function () {
	exec('cat /proc/meminfo', function (error, stdout, stderr) {
		var regex = /(.*?):.*?([0-9]+)/g;
		var mem = {};
		var m;
		while ((m = regex.exec(stdout)) !== null) {
			if (m[1] === 'MemTotal' || m[1] === 'MemFree' || m[1] === 'Buffers' || m[1] === 'Cached'
				|| m[1] === 'Slab' || m[1] === 'Shmem' || m[1] === 'SwapTotal' || m[1] === 'SwapFree') {
				mem[m[1]] = m[2];
			}
		}
		mem['Used'] = mem['MemTotal'] - mem['MemFree'] - mem['Buffers'] - mem['Cached'] - mem['Slab'];
		mem['SwapUsed'] = mem['SwapTotal'] - mem['SwapFree'];
		mem['Total'] = mem['MemTotal'] + mem['SwapTotal'];

		var charts = [
			{
				name: 'used',
				y: (mem['Used'] * 100 / mem['Total']),
				size: (mem['Used'] / 1024 / 1024).toFixed(2)
			}, {
				name: 'free',
				y: (mem['MemFree'] * 100 / mem['Total']),
				size: (mem['MemFree'] / 1024 / 1024).toFixed(2)
			}, {
				name: 'shared',
				y: (mem['Shmem'] * 100 / mem['Total']),
				size: (mem['Shmem'] / 1024 / 1024).toFixed(2)
			}, {
				name: 'buffers',
				y: (mem['Buffers'] * 100 / mem['Total']),
				size: (mem['Buffers'] / 1024 / 1024).toFixed(2)
			}, {
				name: 'cached',
				y: (mem['Cached'] * 100 / mem['Total']),
				size: (mem['Cached'] / 1024 / 1024).toFixed(2)
			}, {
				name: 'slab',
				y: (mem['Slab'] * 100 / mem['Total']),
				size: (mem['Slab'] / 1024 / 1024).toFixed(2)
			}, {
				name: 'swap used',
				y: (mem['SwapUsed'] * 100 / mem['Total']),
				size: (mem['SwapUsed'] / 1024 / 1024).toFixed(2)
			}, {
				name: 'swap free',
				y: (mem['SwapFree'] * 100 / mem['Total']),
				size: (mem['SwapFree'] / 1024 / 1024).toFixed(2)
			}
		];

		send({
			data: {
				event: 'memory',
				totalRam: mem['MemTotal'],
				totalSwap: mem['SwapTotal'],
				charts: charts
			}
		});

		historySave('memory', {
			totalRam: mem['MemTotal'],
			totalSwap: mem['SwapTotal'],
			charts: charts
		});
	});
}, 1000);

// cpu cores stat
var cpuPrev = {};
setInterval(function () {
	exec('cat /proc/stat', function (error, stdout, stderr) {
		var cpusLoad = [];
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

			var diffIdle = idle - (cpuPrev[num].idle || 0);
			var diffTotal = total - (cpuPrev[num].total || 0);

			cpuPrev[num].idle = idle;
			cpuPrev[num].total = total;

			cpusLoad.push(Math.floor((1000 * (diffTotal - diffIdle) / diffTotal + 5) / 10));
		});

		if (!cpusLoad.length)
			return;

		var avg = (cpusLoad.reduce(function (a, b) {
			return a + b;
		}, 0) / cpusLoad.length).toFixed(2);

		send({
			data: {
				event: 'cpu',
				avg: avg,
				charts: cpusLoad
			}
		});

		historySave('cpu', avg);
	});
}, 1000);

// space
setInterval(function () {
	var space = spawn('df', ['-m', '--total', '--type', 'ext4']);
	space.stdout.on('data', function (data) {
		var regex = /(\/dev\/|total).*?[0-9]+[0-9].*?([0-9]+).*?([0-9]+).*?% (.+)/g;
		var total = 0;
		var space = [];
		var s;
		while ((s = regex.exec(data.toString())) !== null) {
			if (s[1] === 'total')
				total = +s[2] + +s[3];

			if (s[1] === '/dev/') {
				space.push([s[4], s[2], s[3]]);
			}
		}
		var charts = [];
		space.forEach(function (e) {
			charts.push({
				name: 'free: ' + e[0],
				y: (e[2] * 100 / total),
				size: (e[2] / 1024).toFixed(2)
			});

			charts.push({
				name: 'used: ' + e[0],
				y: (e[1] * 100 / total),
				size: (e[1] / 1024).toFixed(2)
			});
		});

		send({
			data: {
				event: 'space',
				total: total,
				charts: charts
			}
		});

		historySave('space', {
			total: total,
			charts: charts
		});
	});
}, 1000);

// mysql
var sqlQuery = "SHOW GLOBAL STATUS WHERE Variable_name IN (" +
	"'Bytes_received', 'Bytes_sent', 'Innodb_data_read', 'Innodb_data_written'," +
	"'Uptime', 'Connections', 'Max_used_connections', 'Queries', 'Slow_queries'," +
	"'Com_select', 'Com_update', 'Com_insert', 'Com_delete'," +
	"'Com_alter_table', 'Com_drop_table', 'Created_tmp_tables', 'Created_tmp_disk_tables');";
var mysqlMem = {};
var mysqlInterval = setInterval(function () {
	var mysql = spawn('mysql', ['-e', sqlQuery]);
	mysql.on('error', function () {
		log('warn', '[mysql] client not found');
		clearInterval(mysqlInterval);
	});
	mysql.stdout.on('data', function (data) {
		var mysql = data.toString().match(/(\w+)\t(\d+)/gm);
		var charts = {
			info: {},
			traffic: {},
			innodb: {},
			queries: []
		};
		mysql.forEach(function (value) {
			var keyVal = value.split(/\t/);
			var key = keyVal[0].toLowerCase().replace('com_', '').replace(/_/g, ' ');
			var val = keyVal[1];
			switch (key) {
				case 'uptime':
				case 'max used connections':
					charts['info'][key] = val;
					break;

				case 'bytes received':
				case 'bytes sent':
					charts['traffic'][key] = val - mysqlMem[key] || 0;
					mysqlMem[key] = val;
					break;

				case 'innodb data read':
				case 'innodb data written':
					charts['innodb'][key] = val - mysqlMem[key] || 0;
					mysqlMem[key] = val;
					break;

				default:
					charts['queries'].push({
						k: key,
						v: val - mysqlMem[key] || 0
					});
					mysqlMem[key] = val;
					break;
			}
		});

		send({
			data: {
				event: 'mysql',
				charts: charts
			}
		});

		historySave('mysql', charts['queries']);
	});
}, 1000);

// Redis
var redisMem = {};
var redisInterval = setInterval(function () {
	exec("redis-cli info", function (error, stdout, stderr) {
		if (error) {
			clearInterval(redisInterval);
			return;
		}
		var redis = stdout.match(/(.*?):([0-9.]+)/gm);
		if (!redis)
			return;
		var charts = {
			queries: [],
			traffic: {}
		};
		redis.forEach(function (value) {
			var keyVal = value.split(':');
			var key = keyVal[0].toLowerCase();
			var val = keyVal[1];
			switch (key) {
				case 'total_connections_received':
					charts['queries'].push({
						k: 'connections',
						v: val - redisMem[key] || 0
					});
					redisMem[key] = val;
					break;
				case 'total_commands_processed':
					charts['queries'].push({
						k: 'commands',
						v: val - redisMem[key] || 0
					});
					redisMem[key] = val;
					break;

				case 'used_memory':
					charts['memory'] = +val;
					redisMem[key] = val;
					break;
			}
		});

		send({
			data: {
				event: 'redis',
				charts: charts
			}
		});

		historySave('redis', charts['queries']);
	});
}, 1000);

// PgBouncer
var pgBouncerMem = {};
var pgBouncerInterval = setInterval(function () {
	exec('sudo -u postgres psql -p 6432 -wU pgbouncer pgbouncer -qAc "SHOW STATS;"',
		function (error, stdout, stderr) {
			if (error) {
				clearInterval(pgBouncerInterval);
				return;
			}
			var rows = stdout.split("\n");
			rows.pop();
			rows.pop();
			var head = rows.shift().split('|');
			var charts = {
				sent: 0,
				received: 0,
				queries: []
			};
			rows.forEach(function (row) {
				row = row.split('|');
				var dbName = row[0];
				if (dbName === 'pgbouncer')
					return;

				row.forEach(function (val, key) {
					var name = head[key];
					if (name === 'total_sent')
						charts.sent += val - pgBouncerMem[key] || 0;

					if (name === 'total_received')
						charts.received += val - pgBouncerMem[key] || 0;

					pgBouncerMem[key] = +val;

					if (name === 'total_query_count' || name === 'total_requests') {
						charts.queries.push({
							k: dbName,
							v: val - pgBouncerMem[key + dbName] || 0
						});

						pgBouncerMem[key + dbName] = +val;
					}
				});
			});

			send({
				data: {
					event: 'pg-bouncer',
					charts: charts
				}
			});

			historySave('pg-bouncer', charts['queries']);
		});
}, 1000);

// Nginx
var nginxMem = {};
var nginxStats = function () {
	http.get({
		host: '127.0.0.1',
		port: 80,
		path: '/hgls-nginx'
	}, function (res) {
		if (res.statusCode !== 200) {
			log('error', '[nginx] get status: ' + res.statusCode);
			setTimeout(nginxStats, 1000 * 60);
			return;
		}

		var data = '';
		res.on('data', function (chunk) {
			data += chunk;
		});

		res.on('end', function () {
			var ngx = data.match(/([0-9]+)/gm);
			if (!ngx) {
				log('error', '[nginx] regex failed');
				return;
			}

			var charts = [
				['connections', ngx[0]],
				['accepts', ngx[1] - nginxMem['accepts'] || 0],
				['handled', ngx[2] - nginxMem['handled'] || 0],
				['requests', ngx[3] - nginxMem['requests'] || 0],
				['reading', ngx[4]],
				['writing', ngx[5]],
				['waiting', ngx[6]]
			];

			nginxMem['accepts'] = ngx[1];
			nginxMem['handled'] = ngx[2];
			nginxMem['requests'] = ngx[3];

			send({
				data: {
					event: 'nginx',
					charts: charts
				}
			});

			historySave('nginx', charts);

			setTimeout(nginxStats, 1000);
		});
	}).on('error', function (e) {
		log('error', '[nginx] get http: ' + e.message);
		setTimeout(nginxStats, 1000 * 60);
	});
};
nginxStats();

// Fpm
var fpmMem = {};
var fpmStats = function () {
	http.get({
		host: '127.0.0.1',
		port: 80,
		path: '/hgls-fpm?full&json'
	}, function (res) {
		if (res.statusCode !== 200) {
			log('warn', '[fpm] get status: ' + res.statusCode);
			setTimeout(fpmStats, 1000 * 60);
			return;
		}

		var data = '';
		res.on('data', function (chunk) {
			data += chunk;
		});

		res.on('end', function () {
			try {
				var fpm = JSON.parse(data);
			} catch (e) {
				log('warn', '[fpm] json parse failed: ' + e.toString());
				setTimeout(fpmStats, 1000 * 10);
				return;
			}

			var runtime = 0,
				quantity = 0;
			fpm.processes.forEach(function (e) {
				if (e['request uri'].indexOf('/hgls-fpm') !== -1)
					return;
				runtime += e['request duration'];
				quantity++;
			});

			var charts = [
				['active processes', fpm['active processes']],
				['idle processes', fpm['idle processes']],
				['slow requests', fpm['slow requests'] - fpmMem['slow requests'] || 0],
				['accepted conn', fpm['accepted conn'] - fpmMem['accepted conn'] || 0],
				[
					'runtime avg',
					quantity > 0 && runtime > 0 ? (runtime / quantity / 1e6).toFixed(3) : 0
				]
			];
			fpmMem['slow requests'] = fpm['slow requests'];
			fpmMem['accepted conn'] = fpm['accepted conn'];

			send({
				data: {
					event: 'fpm',
					charts: charts
				}
			});

			historySave('fpm', charts);

			setTimeout(fpmStats, 1000);
		});
	}).on('error', function (e) {
		log('error', '[fpm] get http: ' + e.message);
		setTimeout(fpmStats, 1000 * 60);
	});
};
fpmStats();

// telemetry
var telemetryData = {
	'disks': '',
	'who': ''
};
setInterval(function () {
	telemetryData['disks'] = '';
}, 60 * 60 * 1000);
var telemetry = function () {
	// disks
	if (telemetryData['disks'] === '') {
		telemetryData['disks'] = '...';
		exec('php ' + __dirname + '/disks.php', function (error, stdout, stderr) {
			telemetryData['disks'] = stdout;
		});
	}

	// who
	exec("tail -n 300 /var/log/auth.log | grep -i 'sshd\\[.*\\]: Accepted\\|login\\['",
		function (error, stdout, stderr) {
			telemetryData['who'] = stdout;
		});

	return telemetryData;
};

// history 24
var historyFile = __dirname + '/history.db';
var historyLock = false;
var historyUseEvents = [];
var historySave = function (event, data) {
	if (historyLock)
		return;

	if (historyUseEvents.indexOf(event) === -1)
		historyUseEvents.push(event);

	var time = (new Date).getTime();

	if (time / 1000 % 10 > 1)
		return;

	var row = JSON.stringify({
		e: event,
		t: time,
		d: data
	});

	fs.appendFile(historyFile, row + "\n",
		function (err) {
			if (err)
				log('warn', '[history] failed save: ' + err);

			log('info', '[history] save event: ' + event);
		});
};
setInterval(function () {
	historyLock = true;

	var h24 = 86400;
	var limitRows = h24 * historyUseEvents.length / 10;
	exec('tail -n ' + limitRows + ' ' + historyFile + ' > ' + historyFile + '.tmp', function (error, stdout, stderr) {
		if (error) {
			historyLock = false;
			log('warn', '[history] cleaning failed: ' + error);
			return;
		}
		exec('rm ' + historyFile + ' && mv ' + historyFile + '.tmp ' + historyFile, function () {
			historyLock = false;
		});
	});

	log('info', '[history] trim file, limit rows: ' + limitRows);
}, 15 * 60 * 1000);

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

	if (debug !== 'debug' && debug !== type)
		return;

	console.log('[' + (new Date()).toString() + ']' + color + ' [' + type + '] ' + reset + msg);
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