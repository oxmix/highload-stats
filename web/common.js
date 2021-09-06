var debug = false;
var hgls = (function () {
	var subsNow = null;
	var charts = {};
	var chartsHistory = [];

	$('section.content .buttons span').on('click', function () {
		$('section.content .buttons span').removeClass('active');
		$(this).addClass('active');

		$('section.content > section').removeClass('active');
		$('section.content > section.' + $(this).data('rel')).addClass('active');
	});

	$('section.history ul li').on('click', function () {
		if (historyLock)
			return false;

		$(this).addClass('loading');
		historyLoad(subsNow, $(this).data('range'), () => {
			$('section.history ul li').removeClass('active');
			$(this).removeClass('loading').addClass('active');
		});
	});

	window.setInterval(function () {
		if (ws) {
			ws.send('stats', {time: (new Date).getTime()});
		}
	}, 1000);

	var ws = libWS({
		server: window.location.href.replace('http', 'ws'),
		debug: debug,
		open: function () {
			ws.send('hostnames');
		},
		message: function (data) {
			if (data.event === 'stats') {
				$('#stats').html(
					`online: ${data.online}&nbsp; connections: ${data.quantity}<br>
					history: ${data.history.quantity} rows ${Math.round(data.history.size / 1024 / 1024)} MB<br>
					ping pong: ${((new Date()).getTime() - data.time)} ms&nbsp;
					rss: ${(data.mem.rss / 1024 / 1024).toFixed(2)} MB<br>
					heap total: ${(data.mem.heapTotal / 1024 / 1024).toFixed(2)} MB&nbsp;   
					used: ${(data.mem.heapUsed / 1024 / 1024).toFixed(2)} MB`
				);
				return;
			}

			if (data.event === 'hostnames') {
				return hostnamesParse(data);
			}

			if (data.collection) {
				if (('docker' in data.collection)) {
					data.collection['docker-cpu'] = data.collection['docker'];
					data.collection['docker-mem'] = data.collection['docker'];
					delete data.collection['docker'];
				}

				if (('gpu' in data.collection)) {
					data.collection['gpu-util'] = data.collection['gpu'];
					data.collection['gpu-heal'] = data.collection['gpu'];
					delete data.collection['gpu'];
				}

				Object.keys(data.collection).forEach(function (event) {
					$('.graphics > #' + event).show();
					charts[event] = graphRealtime(event, data.collection[event]);
				});
			}


			if (data.event === 'docker') {
				data.event = 'docker-cpu';
				chartsRender(data);
				data.event = 'docker-mem';
				return chartsRender(data);
			} else if (data.event === 'gpu') {
				data.event = 'gpu-util';
				chartsRender(data);
				data.event = 'gpu-heal';
				return chartsRender(data);
			} else {
				return chartsRender(data);
			}
		}
	});

	var formatter = function (val) {
		if (val > 1024 * 1024) {
			return (val / 1024 / 1024).toFixed(1) + ' MB/s';
		} else {
			return (val / 1024).toFixed(1) + ' KB/s';
		}
	};

	var hostnamesParse = function (data) {
		$('.servers-labels').html('');
		data.list.forEach(function (host) {
			var link = $(`<div><span>${host}</span></div>`);
			link.on('click', function () {
				$('.graphics > div:not(.not-hide)').hide();
				Object.keys(charts).forEach(function (event) {
					if (charts[event]) {
						charts[event].destroy();
					}
				});
				loadDisksClean();
				loadDisksInfo(host);
				historyClean();
				historyLoad(host);
				$('.servers-labels > div').removeClass('selected');
				if (subsNow) {
					ws.unsubscribe(subsNow);
				}
				subsNow = $(this).text()
				ws.subscribe(subsNow);
				$(this).addClass('selected');
			});
			$('.servers-labels').append(link);
		});

		if (!$('.servers-labels > div.selected').length) {
			var host = $('.servers-labels > div:first-child').addClass('selected').text();
			subsNow = host;
			ws.subscribe(host);
			loadDisksInfo(host);
			historyLoad(host);
		}
	};

	var chartCutting = function (chart) {
		var max = 30;

		var offset = chart.data.labels.length - max;
		//console.log("label:", chart.data.labels.length, offset);
		for (var i = 0; i < offset; i++) {
			chart.data.labels.shift();
		}
		chart.data.datasets.forEach(function (dataset, k) {
			var offset = dataset.data.length - max;
			//console.log("data: ", dataset.data.length, offset);
			for (var i = 0; i < offset; i++) {
				dataset.data.shift();
			}
		});
		chart.update();
	};

	var chartsRender = function (data) {
		if (data.event === 'telemetry') {
			$('section.content .info').html(`Uname: ${data.telemetry.uname}
				<br>Uptime: ${data.telemetry.uptime}
				<br>Collector: ${data.telemetry.collector}`);

			return;
		}

		if (!charts[data.event])
			return;

		var chart = charts[data.event];

		if (data.event === 'cpu') {
			chart.options.plugins.title.text = 'Cores ' + data.cores.length + ' load: ' + data.avg + ' %';
			chart.data.datasets.forEach(function (dataset, k) {
				dataset.data.push({
					x: timeFormat(data.time),
					y: data.cores[k]
				});
			});
			chart.update();
			chartCutting(chart);

			// console.log(chart.data.labels);
			// console.log(chart.data.datasets);
		}

		if (data.event === 'memory') {
			var mem = data.memory;
			chart.options.plugins.title.text = 'RAM: ' + Math.ceil(mem.MemTotal / 1024 / 1024) + ' GB'
				+ ' + Swap: ' + Math.ceil(mem.SwapTotal / 1024 / 1024) + ' GB';

			chart.data.datasets[0].data = [
				(mem['Used'] / 1024 / 1024).toFixed(2),
				(mem['MemFree'] / 1024 / 1024).toFixed(2),
				(mem['Shmem'] / 1024 / 1024).toFixed(2),
				(mem['Buffers'] / 1024 / 1024).toFixed(2),
				(mem['Cached'] / 1024 / 1024).toFixed(2),
				(mem['Slab'] / 1024 / 1024).toFixed(2),
				(mem['SwapUsed'] / 1024 / 1024).toFixed(2),
				(mem['SwapFree'] / 1024 / 1024).toFixed(2)
			];
			chart.update();
		}

		if (data.event === 'io-disk') {
			data.io = Math.round(data.io);
			var io = ('000' + data.io.toString()).substring(data.io.toString().length);
			chart.options.plugins.title.text = 'Disks I/O: ' + io + ' %';

			chart.data.datasets[0].data.push([timeFormat(data.time), data.read]);
			chart.data.datasets[1].data.push([timeFormat(data.time), data.write]);
			chart.update();
			chartCutting(chart);
		}

		if (data.event === 'bandwidth') {
			chart.data.datasets.forEach(function (dataset, k) {
				dataset.data.push([timeFormat(data.time), data.bandwidth[k].kbps]);
			});
			chart.update();
			chartCutting(chart);
		}

		if (data.event === 'space') {
			var total = '';
			if (data.total < 1024) {
				total = Math.ceil(data.total) + ' MB';
			} else if (data.total < 1024 * 1024) {
				total = Math.ceil(data.total / 1024) + ' GB';
			} else if (data.total < 1024 ** 3) {
				total = Math.ceil(data.total / 1024 / 1024) + ' TB';
			} else {
				total = Math.ceil(data.total / 1024 / 1024 / 1024) + ' PB';
			}

			chart.options.plugins.title.text = 'Space: ' + total;

			// used
			chart.data.datasets[1].data = data.space.map(function (e) {
				return parseFloat((e[2] / 1024).toFixed(2));
			});
			// free
			chart.data.datasets[0].data = data.space.map(function (e) {
				return parseFloat((e[1] / 1024).toFixed(2));
			});
			chart.update();
		}

		if (data.event === 'gpu-util') {
			var kg = 0;
			data.gpu.forEach(function (_, k) {
				['utilGpu', 'utilMem', 'utilDec', 'utilEnc'].forEach(function (cell) {
					chart.data.datasets[kg++].data.push([timeFormat(data.time), parseInt(data.gpu[k][cell]) || 0]);
				});
			});
			chart.update();
			chartCutting(chart);
		}

		if (data.event === 'gpu-heal') {
			var kh = 0;
			data.gpu.forEach(function (_, k) {
				['fan', 'tmpGpu', 'tmpMem', 'power'].forEach(function (cell) {
					chart.data.datasets[kh++].data.push([timeFormat(data.time), parseInt(data.gpu[k][cell]) || 0]);
				});
			});
			chart.update();
			chartCutting(chart);
		}

		if (data.event === 'docker-cpu') {
			Object.keys(data.docker).forEach(function (name, k) {
				chart.data.datasets[k].data.push([timeFormat(data.time), data.docker[name][0]]);
			});
			chart.update();
			chartCutting(chart);
		}

		if (data.event === 'docker-mem') {
			chart.data.datasets[0].data = Object.values(data.docker).map((e) => e[1]);
			chart.update();
		}

		if (data.event === 'mysql') {
			chart.options.plugins.title.text = 'MySQL Queries: ' + data.mysql['queries'][9].v;
			chart.options.plugins.subtitle.text = 'Traffic sent: ' + formatter(data.mysql['traffic']['bytes sent']);

			chart.data.datasets.forEach(function (dataset, k) {
				dataset.data.push([timeFormat(data.time), data.mysql.queries[k].v]);
			});
			chart.update();
			chartCutting(chart);
		}

		if (data.event === 'redis') {
			chart.options.plugins.title.text = 'Redis: ' + (data.redis.memory / 1024 / 1024).toFixed(2) + ' MB Used';

			chart.data.datasets.forEach(function (dataset, k) {
				dataset.data.push([timeFormat(data.time), data.redis.queries[k].v]);
			});
			chart.update();
			chartCutting(chart);
		}

		if (data.event === 'pg-bouncer') {
			chart.options.plugins.subtitle.text = 'Traffic sent: ' + formatter(data.pgBouncer.sent);

			chart.data.datasets.forEach(function (dataset, k) {
				dataset.data.push([timeFormat(data.time), data.pgBouncer.queries[k].v]);
			});
			chart.update();
			chartCutting(chart);
		}

		if (data.event === 'nginx') {
			chart.data.datasets.forEach(function (dataset, k) {
				dataset.data.push([timeFormat(data.time), parseFloat(data.nginx[k][1])]);

				if (data.nginx[k][0] === 'requests') {
					chart.options.plugins.title.text = 'Nginx: ' + data.nginx[k][1] + ' req/s';
				}
			});
			chart.update();
			chartCutting(chart);
		}

		if (data.event === 'fpm') {
			chart.data.datasets.forEach(function (dataset, k) {
				dataset.data.push([timeFormat(data.time), parseFloat(data.fpm[k][1])]);

				if (data.fpm[k][0] === 'runtime avg') {
					var req = parseFloat(data.fpm[k][1]);
					req = req > 3600 ? '>3600' : req;
					chart.options.plugins.title.text = 'FPM: ' + req;
				}
			});
			chart.update();
			chartCutting(chart);
		}
	};

	var loadDisksLock = false;
	var loadDisksTimer = null;
	var loadDisksInfo = function (host) {
		if (loadDisksLock)
			return;
		loadDisksLock = true;
		$.get('disks?host=' + host, function (r) {
			if (r === '' || r === 'collect') {
				loadDisksTimer = window.setTimeout(function () {
					loadDisksLock = false;
					loadDisksInfo(host);
				}, 3000);
				return;
			}
			window.clearTimeout(loadDisksTimer);

			$('section.disks').html(r);
		});
	};
	var loadDisksClean = function () {
		loadDisksLock = false;
		window.clearTimeout(loadDisksTimer);
		$('section.disks').html(`<div>In work process collecting ...</div>`);
	};

	var historyLock = false;
	var historyLoad = function (host, range, call) {
		if (historyLock)
			return;
		historyLock = true;
		range = range || '-15 minute';
		$.get('history?host=' + host + '&range=' + range, function (r) {
			if (r.status === 'failed')
				return alert(r.message);

			if (call) {
				historyClean();
				call();
			} else {
				$('section.history ul li').removeClass('active');
				$('section.history ul li:first-child').addClass('active');
			}

			var events = {};

			r.rows.forEach(function (e) {
				if (!events[e.event])
					events[e.event] = [];
				events[e.event].push(e);
			});

			$('section.history > div').hide();

			Object.keys(events).forEach(function (event) {
				if (event === 'docker') {
					chartsHistory.push(graphHistory('docker-cpu', events[event]));
					chartsHistory.push(graphHistory('docker-mem', events[event]));
				} else if (event === 'gpu') {
					chartsHistory.push(graphHistory('gpu-util', events[event]));
					chartsHistory.push(graphHistory('gpu-heal', events[event]));
				} else {
					chartsHistory.push(graphHistory(event, events[event]));
				}
			});

			historyLock = false;
		});
	};

	var historyClean = function () {
		historyLock = false;
		chartsHistory.forEach(function (chart) {
			if (!chart)
				return;
			chart.destroy();
		});
	};

	return this;
});

var libWS = function (o) {
	return new function (o) {
		var self = this;
		this.init = function () {
			if (!o.server)
				return;
			this.debug = o.debug || false;
			this.reconnectTimeMin = o.reconnectTimeMin || 5;
			this.reconnectTimeMax = o.reconnectTimeMax || 15;
			try {
				self.socket = new WebSocket(o.server);
			} catch (e) {
				self.socket = {};
			}
			this.work = false;
			this.socket.onopen = function () {
				self.work = true;
				self.log('connected');

				window.setTimeout(function () {
					if (o.open)
						o.open(self);
				}, 100);
			};

			this.socket.onclose = function (event) {
				self.work = false;

				var reSec = Math.floor(Math.random() * (self.reconnectTimeMax - self.reconnectTimeMin + 1)) +
					self.reconnectTimeMin;
				window.setTimeout(function () {
					self.init(o);
				}, reSec * 1000);

				if (event.wasClean) {
					self.log('connection was clean');
				} else {
					self.log('connection breaking');
				}
				self.log('code: ' + event.code + ' reason: ' + event.reason);

				self.log('reconnect through ' + reSec + ' сек.');

				if (o.close)
					o.close(self);
			};

			this.socket.onmessage = function (event) {
				self.log('received data: ' + event.data);
				try {
					var obj = JSON.parse(event.data);
					if (obj && o.message)
						o.message(obj);
				} catch (e) {
					self.log(e);
				}
			};

			this.socket.onerror = function (error) {
				self.log('error ' + error.message);
			};

			return this;
		};

		this.send = function (command, message) {
			if (!this.work)
				return;
			this.socket.send(JSON.stringify({
				command: command,
				data: message
			}));
		};

		this.subscribe = function (channel, data) {
			if (!this.work)
				return;
			this.socket.send(JSON.stringify({
				command: 'subscribe',
				channel: channel,
				data: data || {}
			}));
		};

		this.unsubscribe = function (channel, data) {
			if (!this.work)
				return;
			this.socket.send(JSON.stringify({
				command: 'unsubscribe',
				channel: channel,
				data: data || {}
			}));
		};

		this.log = function (message) {
			if (this.debug)
				console.log('ws | ' + message);
		};

		return this.init();

	}(o);
};

var timeFormat = function (time) {
	var date = new Date(time);
	var hours = date.getHours();
	var minutes = "0" + date.getMinutes();
	var seconds = "0" + date.getSeconds();
	return hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
};

var color = function (index) {
	var db = [
		'#7cb5ec', '#ff9f0a', '#ff375f', '#eae',
		'#f45b5b', '#64d2ff', '#ffd60a', '#bf5af2',
		'#30d158', '#b381b3', '#aee', '#dddf0d'
	];
	return db[index % db.length];
};

$(function () {
	Chart.defaults.responsive = true;
	Chart.defaults.spanGaps = true;
	Chart.defaults.maintainAspectRatio = false;
	Chart.defaults.animation = false;

	Chart.defaults.datasets.line.borderWidth = 2;
	Chart.defaults.datasets.line.pointRadius = 0;
	Chart.defaults.datasets.line.lineTension = 0.3;

	Chart.defaults.plugins.legend.display = true;
	Chart.defaults.plugins.legend.position = 'bottom';
	Chart.defaults.plugins.legend.labels.usePointStyle = true;
	Chart.defaults.plugins.legend.labels.boxWidth = 8;
	Chart.defaults.plugins.legend.display = true;

	Chart.defaults.plugins.title.display = true;
	Chart.defaults.plugins.title.font.size = 18;
	Chart.defaults.plugins.title.font.weight = 300;
	Chart.defaults.plugins.title.padding.bottom = 15;

	Chart.defaults.interaction.intersect = false;
	Chart.defaults.interaction.mode = 'index';

	window.graphRealtime = function (event, data) {
		if (event === 'telemetry') {
			$('section.content .info').html(`Uname: ${data[0].telemetry.uname}
				<br>Uptime: ${data[0].telemetry.uptime}
				<br>Collector: ${data[0].telemetry.collector}`);
			return false;
		}

		var datasets = [];

		if (event === 'cpu') {
			data[0].cores.forEach(function (e, k) {
				var dt = [];
				data.forEach(function (c) {
					dt.push({
						x: timeFormat(c.time),
						y: c.cores[k]
					});
				});

				datasets.push({
					label: k + 1,
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('#' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: false,
							ticks: {
								autoSkip: false,
								maxRotation: 0
							}
						},
						y: {
							suggestedMin: 0,
							suggestedMax: 100,
							title: {
								display: true,
								text: 'Percent'
							}
						}
					},
					plugins: {
						legend: {
							display: false,
						},
						title: {
							text: 'Cores',
						}
					}
				},
			});
		}

		if (event === 'memory') {
			return new Chart($('#' + event + ' canvas')[0].getContext('2d'), {
				type: 'doughnut',
				data: {
					labels: ['used', 'free', 'shared', 'buffers', 'cached', 'slab', 'swap used', 'swap free'],
					datasets: [{
						label: 'Memory',
						data: [0, 0, 0, 0, 0, 0, 0, 0],
						backgroundColor: [color(0), color(1), color(2), color(3), color(4), color(5), color(6), color(7)],
					}]
				},
				options: {
					plugins: {
						legend: {
							display: true,
							labels: {
								padding: 7
							}
						},
						title: {
							text: 'RAM ... GB + Swap ... GB',
						}
					}
				},
			});
		}

		if (event === 'io-disk') {
			var read = [];
			var write = [];
			data.forEach(function (e) {
				read.push([timeFormat(e.time), e.read]);
				write.push([timeFormat(e.time), e.write]);
			});

			datasets.push({
				label: 'read',
				data: read,
				borderColor: 'grey',
				backgroundColor: 'grey'
			});

			datasets.push({
				label: 'write',
				data: write,
				borderColor: '#ff4500',
				backgroundColor: '#ff4500'
			});

			return new Chart($('#' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: false,
							ticks: {
								autoSkip: false,
								maxRotation: 0,
							}
						},
						y: {
							ticks: {
								callback: function (label, index, labels) {
									if (label < 1024) {
										return label;
									} else if (label < 1024 * 1024) {
										return Math.ceil(label / 1024) + ' KB';
									} else if (label < 1024 ** 3) {
										return Math.ceil(label / 1024 / 1024) + ' MB';
									} else {
										return Math.ceil(label / 1024 / 1024 / 1024) + ' GB';
									}
								}
							},
							title: {
								display: true,
								text: 'Speed'
							},
							beginAtZero: true
						}
					},
					plugins: {
						title: {
							text: 'Disks I/O',
						}
					}
				},
			});
		}

		if (event === 'bandwidth') {
			data[0].bandwidth.forEach(function (e, k) {
				var dt = [];
				data.forEach(function (c) {
					dt.push([timeFormat(c.time), c.bandwidth[k].kbps]);
				});

				datasets.push({
					label: e.if,
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k),
					hidden: e.if.indexOf('docker0') !== -1
				});
			});

			return new Chart($('#' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: false,
							ticks: {
								autoSkip: false,
								maxRotation: 0
							}
						},
						y: {
							ticks: {
								callback: function (label, index, labels) {
									if (label < 1000) {
										return label + ' Kb';
									} else if (label < 1000 * 1000) {
										return Math.ceil(label / 1000) + ' Mb';
									} else if (label < 1000 ** 3) {
										return Math.ceil(label / 1000 / 1000) + ' Gb';
									} else {
										return Math.ceil(label / 1000 / 1000 / 1000) + ' Tb';
									}
								}
							},
							title: {
								display: true,
								text: 'Traffic per sec'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'Network bandwidth',
						}
					}
				},
			});
		}

		if (event === 'space') {
			var labels = [];
			data[0].space.forEach(function (e) {
				if (labels.indexOf(e[0]) === -1)
					labels.push(e[0]);
			});

			return new Chart($('#' + event + ' canvas')[0].getContext('2d'), {
				type: 'bar',
				data: {
					labels: labels,
					datasets: [{
						label: 'Used',
						data: [0, 0],
						backgroundColor: color(1),
						maxBarThickness: 50,
					}, {
						label: 'Free',
						data: [0, 0],
						backgroundColor: color(0),
						maxBarThickness: 50,
					}]
				},
				options: {
					indexAxis: 'y',
					scales: {
						x: {
							stacked: true,
							ticks: {
								callback: function (label, index, labels) {
									if (label < 1024) {
										return label + ' GB';
									} else if (label < 1024 * 1024) {
										return Math.ceil(label / 1024) + ' TB';
									} else if (label < 1024 ** 3) {
										return Math.ceil(label / 1024 / 1024) + ' PB';
									} else {
										return Math.ceil(label / 1024 / 1024 / 1024) + ' EB';
									}
								}
							}
						},
						y: {
							stacked: true,
						}
					},
					plugins: {
						title: {
							text: 'Space ... TB',
						}
					}
				},
			});
		}

		if (event === 'gpu-util') {
			/*			[ { name: 'GeForce GTX 1070',
							pciDev: '00',
							pciTx: '38000',
							pciRx: '107000',
							fan: '90',
							memUse: '6074',
							memFree: '2045',
							utilGpu: '100',
							utilMem: '87',
							utilEnc: '15',
							utilDec: '23',
							tmpGpu: '77',
							tmpMem: 'N/A',
							power: '94.11',
							clockSh: '1632',
							clockSm: '1632',
							clockMem: '3802',
							clockVideo: '1480' } ]*/

			var utils = {};
			data[0].gpu.forEach(function (g, k) {
				var gpu = '[' + g.pciDev + ' ' + (g.name.replace('GeForce ', '') + ']');
				data.forEach(function (c) {
					['utilGpu', 'utilMem', 'utilDec', 'utilEnc'].forEach(function (cell) {
						var name = gpu + ' ' + cell.replace('util', '');
						if (!(name in utils)) {
							utils[name] = [];
						}
						utils[name].push([timeFormat(c.time), c.gpu[k][cell]]);
					});
				});
			});

			Object.keys(utils).forEach(function (name, k) {
				datasets.push({
					label: name,
					data: utils[name],
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('#' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: false,
							ticks: {
								autoSkip: false,
								maxRotation: 0
							}
						},
						y: {
							suggestedMin: 0,
							suggestedMax: 100,
							title: {
								display: true,
								text: 'Percent'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'GPUs Utilization',
						}
					}
				},
			});
		}

		if (event === 'gpu-heal') {
			var heals = {};
			data[0].gpu.forEach(function (g, k) {
				var gpu = '[' + g.pciDev + ' ' + (g.name.replace('GeForce ', '') + ']');
				data.forEach(function (c) {
					['fan', 'tmpGpu', 'tmpMem', 'power'].forEach(function (cell) {
						var name = gpu + ' ' + cell;
						if (!(name in heals)) {
							heals[name] = [];
						}
						heals[name].push([timeFormat(c.time), c.gpu[k][cell] || 0]);
					});
				});
			});

			Object.keys(heals).forEach(function (name, k) {
				datasets.push({
					label: name,
					data: heals[name],
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('#' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: false,
							ticks: {
								autoSkip: false,
								maxRotation: 0
							}
						},
						y: {
							suggestedMin: 0,
							suggestedMax: 100,
							title: {
								display: true,
								text: 'Percent, °C, Watt'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'GPUs Heal',
						}
					}
				},
			});
		}

		if (event === 'docker-cpu') {
			Object.keys(data[0].docker).forEach(function (name, k) {
				var dt = [];
				data.forEach(function (c) {
					var val = 0;
					if (name in c.docker) {
						val = c.docker[name][0];
					}
					dt.push([timeFormat(c.time), val]);
				});

				datasets.push({
					label: (name.length > 18 ? name.substr(0, 15) + '...' : name),
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('#' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: false,
							ticks: {
								autoSkip: false,
								maxRotation: 0
							}
						},
						y: {
							title: {
								display: true,
								text: 'Percent'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'Docker CPU'
						}
					}
				},
			});
		}

		if (event === 'docker-mem') {
			Object.keys(data[0].docker).forEach(function (name, k) {
				datasets.push({
					label: (name.length > 18 ? name.substr(0, 15) + '...' : name),
					data: [data[0].docker[name][1]],
					borderColor: color(k),
					backgroundColor: color(k),
					maxBarThickness: 50,
				});
			});

			return new Chart($('#' + event + ' canvas')[0].getContext('2d'), {
				type: 'bar',
				data: {
					labels: ['Container: memory bytes'],
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: false,
							ticks: {
								autoSkip: false,
							}
						},
						y: {
							ticks: {
								callback: function (label, index, labels) {
									if (label < 1024) {
										return label + ' B';
									} else if (label < 1024 * 1024) {
										return Math.ceil(label / 1024) + ' KB';
									} else if (label < 1024 ** 3) {
										return Math.ceil(label / 1024 / 1024) + ' MB';
									} else {
										return Math.ceil(label / 1024 / 1024 / 1024) + ' GB';
									}
								}
							},
							title: {
								display: true,
								text: 'Size'
							},
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'Docker memory'
						}
					}
				},
			});
		}

		if (event === 'mysql') {
			data[0].mysql.queries.forEach(function (e, k) {
				var dt = [];
				data.forEach(function (c) {
					dt.push([timeFormat(c.time), c.mysql.queries[k].v]);
				});

				datasets.push({
					label: e.k,
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k),
					hidden: e.k === 'queries'
				});
			});

			return new Chart($('#' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: false,
							ticks: {
								autoSkip: false,
								maxRotation: 0
							}
						},
						y: {
							title: {
								display: true,
								text: 'Quantity'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'MySQL',
							padding: {
								bottom: 2
							}
						},
						subtitle: {
							display: true,
							text: '...',
							padding: {
								bottom: 3
							}
						}
					}
				},
			});
		}

		if (event === 'redis') {
			data[0].redis.queries.forEach(function (e, k) {
				var dt = [];
				data.forEach(function (c) {
					dt.push([timeFormat(c.time), c.redis.queries[k].v]);
				});

				datasets.push({
					label: e.k,
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('#' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: false,
							ticks: {
								autoSkip: false,
								maxRotation: 0
							}
						},
						y: {
							title: {
								display: true,
								text: 'Quantity'
							}
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'Redis',
						}
					}
				},
			});
		}

		if (event === 'pg-bouncer') {
			data[0].pgBouncer.queries.forEach(function (e, k) {
				var dt = [];
				data.forEach(function (c) {
					dt.push([timeFormat(c.time), (c.pgBouncer.queries[k] || {v: 0}).v]);
				});

				datasets.push({
					label: e.k,
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('#' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: false,
							ticks: {
								autoSkip: false,
								maxRotation: 0
							}
						},
						y: {
							title: {
								display: true,
								text: 'Quantity'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'PgBouncer',
							padding: {
								bottom: 2
							}
						},
						subtitle: {
							display: true,
							text: '...',
							padding: {
								bottom: 3
							}
						}
					}
				},
			});
		}

		if (event === 'nginx') {
			data[0].nginx.forEach(function (e, k) {
				var dt = [];
				data.forEach(function (c) {
					dt.push([timeFormat(c.time), c.nginx[k][1]]);
				});

				datasets.push({
					label: e[0],
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('#' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: false,
							ticks: {
								autoSkip: false,
								maxRotation: 0
							}
						},
						y: {
							title: {
								display: true,
								text: 'Quantity'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'Nginx'
						}
					}
				},
			});
		}

		if (event === 'fpm') {
			data[0].fpm.forEach(function (e, k) {
				var dt = [];
				data.forEach(function (c) {
					dt.push([timeFormat(c.time), c.fpm[k][1]]);
				});

				datasets.push({
					label: e[0],
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('#' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: false,
							ticks: {
								autoSkip: false,
								maxRotation: 0
							}
						},
						y: {
							title: {
								display: true,
								text: 'Quantity'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'FPM'
						}
					}
				},
			});
		}
	};

	window.graphHistory = function (event, data) {
		var datasets = [];

		$('section.history .' + event).show();

		if (event === 'cpu') {
			var dt = [];
			data.forEach(function (c) {
				dt.push({
					x: timeFormat(c.time),
					y: c.avg
				});
			});

			datasets.push({
				label: 'avg',
				data: dt,
				borderColor: color(0),
				backgroundColor: color(0)
			});

			return new Chart($('section.history .' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					layout: {
						padding: {
							left: 20
						}
					},
					scales: {
						x: {
							display: true,
							ticks: {
								autoSkip: true,
								maxRotation: 0
							}
						},
						y: {
							suggestedMin: 0,
							suggestedMax: 100,
							title: {
								display: true,
								text: 'Percent'
							}
						}
					},
					plugins: {
						legend: {
							display: false,
						},
						title: {
							text: 'Cores ' + data[0].cores.length + ' Load average',
						}
					}
				},
			});
		}

		if (event === 'memory') {
			['Used', 'MemFree', 'Shmem', 'Buffers',
				'Cached', 'Slab', 'SwapUsed', 'SwapFree'].forEach(function (name, k) {
				var dt = [];
				data.forEach(function (c) {
					dt.push({
						x: timeFormat(c.time),
						y: c.memory[name]
					});
				});

				datasets.push({
					label: name,
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('section.history .' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: true,
							ticks: {
								autoSkip: true,
								maxRotation: 0
							}
						},
						y: {
							ticks: {
								callback: function (label, index, labels) {
									if (label < 1024) {
										return label + ' KB';
									} else if (label < 1024 * 1024) {
										return Math.ceil(label / 1024) + ' MB';
									} else if (label < 1024 ** 3) {
										return Math.ceil(label / 1024 / 1024) + ' GB';
									} else {
										return Math.ceil(label / 1024 / 1024 / 1024) + ' TB';
									}
								}
							},
							title: {
								display: true,
								text: 'Size'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'Memory',
						}
					}
				},
			});
		}

		if (event === 'io-disk') {
			var read = [];
			var write = [];
			var io = [];
			data.forEach(function (e) {
				read.push([timeFormat(e.time), e.read]);
				write.push([timeFormat(e.time), e.write]);
				io.push([timeFormat(e.time), e.io]);
			});

			datasets.push({
				label: 'read',
				data: read,
				borderColor: 'grey',
				backgroundColor: 'grey'
			});

			datasets.push({
				label: 'write',
				data: write,
				borderColor: '#ff4500',
				backgroundColor: '#ff4500'
			});

			datasets.push({
				label: 'io',
				data: io,
				borderColor: color(3),
				backgroundColor: color(3)
			});

			return new Chart($('section.history .' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: true,
							ticks: {
								autoSkip: true,
								maxRotation: 0,
							}
						},
						y: {
							ticks: {
								callback: function (label, index, labels) {
									if (label < 1024) {
										return label;
									} else if (label < 1024 * 1024) {
										return Math.ceil(label / 1024) + ' KB';
									} else if (label < 1024 ** 3) {
										return Math.ceil(label / 1024 / 1024) + ' MB';
									} else {
										return Math.ceil(label / 1024 / 1024 / 1024) + ' GB';
									}
								}
							},
							title: {
								display: true,
								text: 'Speed'
							},
							beginAtZero: true
						}
					},
					plugins: {
						title: {
							text: 'Disks I/O',
						}
					}
				},
			});
		}

		if (event === 'bandwidth') {
			data[0].bandwidth.forEach(function (e, k) {
				var dt = [];
				data.forEach(function (c) {
					dt.push([timeFormat(c.time), c.bandwidth[k].kbps]);
				});

				datasets.push({
					label: e.if,
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k),
					hidden: e.if.indexOf('docker0') !== -1
				});
			});

			return new Chart($('section.history .' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: true,
							ticks: {
								autoSkip: true,
								maxRotation: 0
							}
						},
						y: {
							ticks: {
								callback: function (label, index, labels) {
									if (label < 1000) {
										return label + ' Kb';
									} else if (label < 1000 * 1000) {
										return Math.ceil(label / 1000) + ' Mb';
									} else if (label < 1000 ** 3) {
										return Math.ceil(label / 1000 / 1000) + ' Gb';
									} else {
										return Math.ceil(label / 1000 / 1000 / 1000) + ' Tb';
									}
								}
							},
							title: {
								display: true,
								text: 'Speed'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'Network bandwidth',
						}
					}
				},
			});
		}

		if (event === 'space') {
			var k = 0;
			data[0].space.forEach(function (e) {
				var used = [];
				var free = [];
				data.forEach(function (c) {
					used.push([timeFormat(c.time), e[1]]);
					free.push([timeFormat(c.time), e[2]]);
				});
				datasets.push({
					label: 'used: ' + e[0],
					data: used,
					borderColor: color(k),
					backgroundColor: color(k++),
				});
				datasets.push({
					label: 'free: ' + e[0],
					data: free,
					borderColor: color(k),
					backgroundColor: color(k++)
				});
			});

			return new Chart($('section.history .' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: true,
							ticks: {
								autoSkip: true,
								maxRotation: 0,
							}
						},
						y: {
							ticks: {
								callback: function (label, index, labels) {
									if (label < 1024) {
										return label + ' MB';
									} else if (label < 1024 * 1024) {
										return Math.ceil(label / 1024) + ' GB';
									} else if (label < 1024 ** 3) {
										return Math.ceil(label / 1024 / 1024) + ' TB';
									} else {
										return Math.ceil(label / 1024 / 1024 / 1024) + ' PB';
									}
								}
							},
							title: {
								display: true,
								text: 'Size'
							},
							beginAtZero: true
						}
					},
					plugins: {
						title: {
							text: 'Space',
						}
					}
				},
			});
		}

		if (event === 'gpu-util') {
			var utils = {};
			data[0].gpu.forEach(function (g, k) {
				var gpu = '[' + g.pciDev + ' ' + (g.name.replace('GeForce ', '') + ']');
				data.forEach(function (c) {
					['utilGpu', 'utilMem', 'utilDec', 'utilEnc'].forEach(function (cell) {
						var name = gpu + ' ' + cell.replace('util', '');
						if (!(name in utils)) {
							utils[name] = [];
						}
						utils[name].push([timeFormat(c.time), c.gpu[k][cell]]);
					});
				});
			});

			Object.keys(utils).forEach(function (name, k) {
				datasets.push({
					label: name,
					data: utils[name],
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('section.history .' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					layout: {
						padding: {
							left: 20
						}
					},
					scales: {
						x: {
							display: true,
							ticks: {
								autoSkip: true,
								maxRotation: 0
							}
						},
						y: {
							suggestedMin: 0,
							suggestedMax: 100,
							title: {
								display: true,
								text: 'Percent'
							}
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'GPUs Utilization',
						}
					}
				},
			});
		}

		if (event === 'gpu-heal') {
			var heals = {};
			data[0].gpu.forEach(function (g, k) {
				var gpu = '[' + g.pciDev + ' ' + (g.name.replace('GeForce ', '') + ']');
				data.forEach(function (c) {
					['fan', 'tmpGpu', 'tmpMem', 'power'].forEach(function (cell) {
						var name = gpu + ' ' + cell;
						if (!(name in heals)) {
							heals[name] = [];
						}
						heals[name].push([timeFormat(c.time), c.gpu[k][cell] || 0]);
					});
				});
			});

			Object.keys(heals).forEach(function (name, k) {
				datasets.push({
					label: name,
					data: heals[name],
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('section.history .' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					layout: {
						padding: {
							left: 20
						}
					},
					scales: {
						x: {
							display: true,
							ticks: {
								autoSkip: true,
								maxRotation: 0
							}
						},
						y: {
							suggestedMin: 0,
							suggestedMax: 100,
							title: {
								display: true,
								text: 'Percent, °C, Watt'
							}
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'GPUs Heal',
						}
					}
				},
			});
		}

		if (event === 'docker-cpu') {
			Object.keys(data[0].docker).forEach(function (name, k) {
				var dt = [];
				data.forEach(function (c) {
					var val = 0;
					if (name in c.docker) {
						val = c.docker[name][0];
					}

					dt.push([timeFormat(c.time), val]);
				});

				datasets.push({
					label: name,
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('section.history .' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					layout: {
						padding: {
							left: 20
						}
					},
					scales: {
						x: {
							display: true,
							ticks: {
								autoSkip: true,
								maxRotation: 0
							}
						},
						y: {
							title: {
								display: true,
								text: 'Percent'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'Docker CPU'
						}
					}
				},
			});
		}

		if (event === 'docker-mem') {
			Object.keys(data[0].docker).forEach(function (name, k) {
				var dt = [];
				data.forEach(function (c) {
					var val = 0;
					if (name in c.docker) {
						val = c.docker[name][1];
					}
					dt.push([timeFormat(c.time), val]);
				});

				datasets.push({
					label: name,
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('section.history .' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					scales: {
						x: {
							display: true,
							ticks: {
								autoSkip: true,
								maxRotation: 0
							}
						},
						y: {
							title: {
								display: true,
								text: 'Size'
							},
							beginAtZero: true,
							ticks: {
								callback: function (label, index, labels) {
									if (label < 1024) {
										return label + ' B';
									} else if (label < 1024 * 1024) {
										return Math.ceil(label / 1024) + ' KB';
									} else if (label < 1024 ** 3) {
										return Math.ceil(label / 1024 / 1024) + ' MB';
									} else {
										return Math.ceil(label / 1024 / 1024 / 1024) + ' GB';
									}
								}
							}
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'Docker memory'
						}
					}
				},
			});
		}

		if (event === 'mysql') {
			data[0].mysql.queries.forEach(function (e, k) {
				var dt = [];
				data.forEach(function (c) {
					dt.push([timeFormat(c.time), c.mysql.queries[k].v]);
				});

				datasets.push({
					label: e.k,
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k),
					hidden: e.k === 'queries'
				});
			});

			return new Chart($('section.history .' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					layout: {
						padding: {
							left: 20
						}
					},
					scales: {
						x: {
							display: true,
							ticks: {
								autoSkip: true,
								maxRotation: 0
							}
						},
						y: {
							title: {
								display: true,
								text: 'Quantity'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'MySQL',
						}
					}
				},
			});
		}

		if (event === 'redis') {
			data[0].redis.queries.forEach(function (e, k) {
				var dt = [];
				data.forEach(function (c) {
					dt.push([timeFormat(c.time), c.redis.queries[k].v]);
				});

				datasets.push({
					label: e.k,
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('section.history .' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					layout: {
						padding: {
							left: 20
						}
					},
					scales: {
						x: {
							display: true,
							ticks: {
								autoSkip: true,
								maxRotation: 0
							}
						},
						y: {
							title: {
								display: true,
								text: 'Quantity'
							}
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'Redis',
						}
					}
				},
			});
		}

		if (event === 'pg-bouncer') {
			data[0].pgBouncer.queries.forEach(function (e, k) {
				var dt = [];
				data.forEach(function (c) {
					dt.push([timeFormat(c.time), (c.pgBouncer.queries[k] || {v: 0}).v]);
				});

				datasets.push({
					label: e.k,
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('section.history .' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					layout: {
						padding: {
							left: 20
						}
					},
					scales: {
						x: {
							display: true,
							ticks: {
								autoSkip: true,
								maxRotation: 0
							}
						},
						y: {
							title: {
								display: true,
								text: 'Quantity'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'PgBouncer',
						}
					}
				},
			});
		}

		if (event === 'nginx') {
			data[0].nginx.forEach(function (e, k) {
				var dt = [];
				data.forEach(function (c) {
					dt.push([timeFormat(c.time), c.nginx[k][1]]);
				});

				datasets.push({
					label: e[0],
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('section.history .' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					layout: {
						padding: {
							left: 20
						}
					},
					scales: {
						x: {
							display: true,
							ticks: {
								autoSkip: true,
								maxRotation: 0
							}
						},
						y: {
							title: {
								display: true,
								text: 'Quantity'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'Nginx'
						}
					}
				},
			});
		}

		if (event === 'fpm') {
			data[0].fpm.forEach(function (e, k) {
				var dt = [];
				data.forEach(function (c) {
					dt.push([timeFormat(c.time), c.fpm[k][1]]);
				});

				datasets.push({
					label: e[0],
					data: dt,
					borderColor: color(k),
					backgroundColor: color(k)
				});
			});

			return new Chart($('section.history .' + event + ' canvas')[0].getContext('2d'), {
				type: 'line',
				data: {
					datasets: datasets
				},
				options: {
					layout: {
						padding: {
							left: 20
						}
					},
					scales: {
						x: {
							display: true,
							ticks: {
								autoSkip: true,
								maxRotation: 0
							}
						},
						y: {
							title: {
								display: true,
								text: 'Quantity'
							},
							beginAtZero: true
						}
					},
					plugins: {
						legend: {
							display: true,
						},
						title: {
							text: 'FPM'
						}
					}
				},
			});
		}
	};

	new hgls();
});