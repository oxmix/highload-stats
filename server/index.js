#!/usr/bin/env node

const
	config = require('./config'),
	helpers = require('./helpers'),
	ws = require('ws'),
	collector = require('./collector'),
	exec = require('child_process').exec,
	execSync = require('child_process').execSync,
	fs = require('fs'),
	http = require('http'),
	Sqlite = require('better-sqlite3');

helpers.debug = false;
const processName = 'highload-stats';
switch (process.argv[2]) {
	case 'start':
		console.log('Start hgls');
		exec(__dirname + '/index.js > ' + __dirname + '/error.log 2>&1 &');
		return;

	case 'stop':
		console.log('Kill hgls');
		exec('killall ' + processName);
		return;

	case 'restart':
		console.log('Restart hgls');
		exec('killall ' + processName);
		exec(__dirname + '/index.js > ' + __dirname + '/error.log 2>&1 &');
		return;

	case 'debug':
		console.log('Start hgls with debug mode');
		helpers.debug = true;
		break;
}

process.title = processName;


const db = new Sqlite(__dirname + '/history.db');
db.exec('CREATE TABLE IF NOT EXISTS history (time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,' +
	' host VARCHAR (100), event VARCHAR (100), json TEXT)');
db.exec('CREATE INDEX IF NOT EXISTS history_time_index ON history (time desc)');

let collection = {};
new collector.start(function (o) {
	if (o.time / 1000 % 10 < 1) {
		db.prepare('INSERT INTO history (host, event, json) VALUES (?, ?, ?)')
			.run(o.hostname, o.event, JSON.stringify(o));
	}

	if (!(o.hostname in collection)) {
		collection[o.hostname] = {};
	}

	if (!(o.event in collection[o.hostname])) {
		collection[o.hostname][o.event] = [];
	}

	if (o.event === 'telemetry' || o.event === 'memory' || o.event === 'space') {
		collection[o.hostname][o.event] = [o];
	} else {
		collection[o.hostname][o.event].push(o);
	}

	sendToChannel(o.hostname, o);

	if (collection[o.hostname][o.event].length > 30) {
		collection[o.hostname][o.event].shift();
	}
});


const app = http.createServer(function (req, res) {
	if (!req.url.length) {
		res.writeHead(400);
		helpers.log('warn', '[web] bad request');
		return res.end('bad request');
	}

	const urlFull = req.url.split('?'),
		url = urlFull[0] || '/',
		urlParams = new URLSearchParams(urlFull[1] || '');

	var routers = {
		'/': 'web/index.html',
		'/favicon.ico': 'web/favicon.ico',
		'/jquery.js': 'web/jquery.js',
		'/chart.js': 'web/chart.js',
		'/common.js': 'web/common.js',
		'/common.css': 'web/common.css',
		'/history': function (res) {
			res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});

			try {
				const host = urlParams.get('host') || 'none';
				const range = urlParams.get('range') || '-15 minute';
				const rows = db.prepare(`SELECT json
										 FROM history
										 WHERE time > datetime('now', ?) AND host = ?
										 ORDER BY time ASC`)
					.all(range, host).map(e => JSON.parse(e.json));

				return JSON.stringify({
					status: 'success',
					rows: rows
				});
			} catch (err) {
				return JSON.stringify({
					failed: 'success',
					message: err.toString()
				});
			}
		},
		'/telemetry': function (res) {
			res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
			let result = [];
			Object.keys(collection).forEach(function (host) {
				if (!('telemetry' in collection[host]) || !collection[host].telemetry[0])
					return;
				var t = 'telemetry' in collection[host].telemetry[0] ? collection[host].telemetry[0].telemetry : {};
				result.push({
					host: collection[host].telemetry[0].hostname || '',
					time: collection[host].telemetry[0].time || 0,
					collector: t.collector || '',
					uptime: t.uptime || '',
					uname: t.uname || '',
				});
			});
			return JSON.stringify(result);
		},
		'/telemetry/who': function (res) {
			res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
			let result = [];
			Object.keys(collection).forEach(function (host) {
				if (!('telemetry' in collection[host]) || !collection[host].telemetry[0])
					return;
				var t = 'telemetry' in collection[host].telemetry[0] ? collection[host].telemetry[0].telemetry : {};
				result.push({
					host: collection[host].telemetry[0].hostname || '',
					time: collection[host].telemetry[0].time || 0,
					who: t.who || ''
				});
			});
			return JSON.stringify(result);
		},
		'/telemetry/disks': function (res) {
			res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
			let result = [];
			Object.keys(collection).forEach(function (host) {
				if (!('telemetry' in collection[host]) || !collection[host].telemetry[0])
					return;
				var t = 'telemetry' in collection[host].telemetry[0] ? collection[host].telemetry[0].telemetry : {};
				result.push({
					host: collection[host].telemetry[0].hostname || '',
					time: collection[host].telemetry[0].time || 0,
					disks: t.disks || {}
				});
			});
			return JSON.stringify(result);
		},
		'/disks': function (res) {
			res.writeHead(200, {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				'Pragma': 'no-cache',
				'Expires': '0'
			});

			const host = urlParams.get('host') || 'none';

			if (!(host in collection) || !('telemetry' in collection[host]) || !(0 in collection[host].telemetry))
				return 'collect';

			const disks = collection[host].telemetry[0].telemetry.disks;

			if (!disks || disks === '' || disks === '...')
				return 'collect';

			const temp = '/tmp/hgls-disks-' + Math.random() + '.json';

			try {
				fs.writeFileSync(temp, JSON.stringify(collection[host].telemetry[0].telemetry.disks));

				const result = execSync("php " + __dirname + "/../server/disks-render.php < " + temp).toString();

				fs.unlinkSync(temp);

				return result;
			} catch (e) {
				return 'error: '.e.toString();
			}
		}
	};

	if (!(url in routers)) {
		res.writeHead(404);
		res.end('highload-stats: 404');
		return;
	}

	var action = routers[url];
	if (typeof action !== 'function')
		helpers.log('info', '[web] router action: ' + action);

	if (typeof action === 'function') {
		res.end(action(res));
		return;
	}

	var path = __dirname + '/../' + action;
	if (!fs.existsSync(path)) {
		res.writeHead(404);
		res.end('highload-stats: 404');
		helpers.log('warn', '[web] 404: ' + path);
		return;
	}

	res.writeHead(200);
	(fs.createReadStream(path)).pipe(res);
}).listen(config.web.port, config.web.host);

let subscribers = {};
let unique = 0;
const wss = new ws.Server({server: app});
wss.on('connection', function (ws, req) {
	let remoteAddress = ws._socket.remoteAddress;
	if ('x-forwarded-for' in req.headers)
		remoteAddress = req.headers['x-forwarded-for'].split(/\s*,\s*/)[0];

	helpers.log('info', '[ws] new connect: ' + remoteAddress);

	ws.hgls = {
		unique: ++unique,
		subscribed: [],
		remoteAddress: remoteAddress,
		timeCreate: (new Date).getTime(),
		pong: (new Date).getTime(),
	};

	ws.on('message', function (json) {
		try {
			var obj = JSON.parse(json);
		} catch (e) {
			return helpers.log('error', '[ws] json parse error: ' + e);
		}

		helpers.log('debug', '[ws] message: ' + json);

		if (obj.command === 'hostnames') {
			send({
				event: obj.command,
				list: Object.keys(collection)
			}, ws);
		}

		if (obj.command === 'subscribe') {
			if (!obj.channel)
				return;

			if (obj.channel in collection) {
				send({collection: collection[obj.channel]}, ws);
			}

			return subscribe(ws, obj.channel);
		}

		if (obj.command === 'unsubscribe') {
			if (!obj.channel)
				return;

			return unsubscribe(ws, obj.channel);
		}

		if (obj.command === 'stats') {
			let online = [];
			let quantity = 0;
			wss.clients.forEach(function (ws) {
				if (online.indexOf(ws.hgls.remoteAddress) === -1) {
					online.push(ws.hgls.remoteAddress);
				}
				quantity++;
			});
			send({
				event: obj.command,
				mem: process.memoryUsage(),
				quantity: quantity,
				online: online.length,
				history: {
					quantity: historyQuantity,
					size: historySize
				},
				time: obj.data.time
			}, ws);
		}
	});

	ws.on('close', function (errorId) {
		helpers.log('info', '[ws] close[' + errorId + ']');

		unsubscribe(ws);
	});

	ws.on('pong', function (_data) {
		ws.hgls.pong = (new Date).getTime();
	});

	ws.on('disconnect', function () {
		helpers.log('warn', '[ws] disconnecting');
	});

	ws.on('error', function (error) {
		helpers.log('error', '[ws] error: ' + error);
	});
});

helpers.log('info', '[hgls] server start: ' + config.web.host + ':' + config.web.port + ' pid: ' + process.pid);

/**
 * Send message
 *
 * @param object
 * @param connect
 */
let send = (object, connect) => {
	if (typeof connect === 'undefined' || connect.readyState !== 1)
		return false;

	connect.send(JSON.stringify(object));
};

/**
 * Send message to channel
 *
 * @param channel
 * @param data
 */
let sendToChannel = (channel, data) => {
	if (!(channel in subscribers))
		return;

	Object.values(subscribers[channel]).forEach(function (connect) {
		send(data, connect);
	});
};

/**
 *
 * @param connect
 * @param channel
 * @returns {boolean}
 */
const subscribe = (connect, channel) => {
	if (!subscribers[channel])
		subscribers[channel] = {};

	subscribers[channel][connect.hgls.unique] = connect;
	connect.hgls.subscribed.push(channel);

	return true;
};

/**
 *
 * @param connect
 * @param channel
 * @returns {boolean}
 */
const unsubscribe = (connect, channel) => {
	if (!channel) {
		connect.hgls.subscribed.forEach(function (channel) {
			delete subscribers[channel][connect.hgls.unique];
		});
	} else {
		delete subscribers[channel][connect.hgls.unique];
	}

	return true;
};

/**
 * Ping sleep connections
 */
const timeout = 180 * 1000;
const timeoutTerminate = 3 * 1000; // max ping latency
(function () {
	setInterval(function () {
		let ping = 0,
			lost = 0;
		wss.clients.forEach(function (ws) {
			if ((new Date).getTime() - ws.hgls.pong > timeout + timeoutTerminate) {
				lost++;
				unsubscribe(ws);
				ws.terminate();
			} else {
				ping++;
				ws.ping();
			}
		});

		helpers.log('debug', '[hgls] quantity sent ping: ' + ping + ' lost: ' + lost);
	}, timeout);
})();

/**
 * Print info memory usage process
 */
(function () {
	setInterval(function () {
		let infoMem = [];
		const pmu = process.memoryUsage();
		for (const s in pmu) {
			if (pmu.hasOwnProperty(s))
				infoMem.push(s + ': ' + Math.round(pmu[s] / 1024) + 'Kb');
		}
		helpers.log('info', '[hgls] memory usage ' + infoMem.join(' / '));
	}, 3 * 60 * 1000);
}());

/**
 * Trimming db
 */
let historySize = 0;
let historyQuantity = 0;
let historyStats = function () {
	historyQuantity = db.prepare('SELECT COUNT(*) AS count FROM history').get().count;
	historySize = fs.statSync(__dirname + '/history.db').size;
};
let historyTrim = function () {
	if (historyQuantity > 0) {
		db.exec("DELETE FROM history WHERE time < datetime('now', '-24 hours')");
		db.exec('vacuum');
		helpers.log('info', '[history] trimming db');
	}
};
historyStats();
historyTrim();
setInterval(historyStats, 60 * 1000);
setInterval(historyTrim, 15 * 60 * 1000);