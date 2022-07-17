const
	helpers = require('./helpers'),
	ws = require('ws'),
	http = require('http');

/**
 * Collector server
 * @type {Function}
 */
module.exports.start = (function (call) {
	const app = http.createServer(function (req, res) {
		res.writeHead(403);
		res.end('hgls-collector: 403');
	}).listen(3939, () => {
		helpers.log('info', '[collector] server started at :3939');
	});

	let wss = new ws.Server({server: app});
	wss.on('connection', function (ws, req) {
		let remoteAddress = ws._socket.remoteAddress;
		if ('x-real-ip' in req.headers)
			remoteAddress = req.headers['x-real-ip'].split(/\s*,\s*/)[0];

		helpers.log('info', '[collector] new connect, ip: ' + remoteAddress);

		ws.hgls = {
			pong: (new Date).getTime(),
			timeCreate: (new Date).getTime(),
			remoteAddress: remoteAddress
		}

		ws.on('message', function (json) {
			try {
				var obj = JSON.parse(json);
			} catch (err) {
				return helpers.log('error', '[collector] json parse error: ' + err.toString());
			}

			if (!('hostname' in obj)) {
				return helpers.log('error', '[collector] undefined hostname');
			}

			if (call) {
				call(obj)
			}

			helpers.log('debug', '[collector] message: ' + json);
		});

		ws.on('close', function (errorId) {
			ws.terminate();
			helpers.log('info', '[collector] close[' + errorId + ']');
		});

		ws.on('pong', function (_data) {
			ws.hgls.pong = (new Date).getTime();
		});

		ws.on('disconnect', function () {
			helpers.log('warn', '[collector] disconnecting');
		});

		ws.on('error', function (error) {
			helpers.log('error', '[collector] ' + error);
		});
	});
});