var debug = false;
var highLoad = (function () {

	this.webSocketIndef = null;
	this.graffCount1 = 0;
	this.graffCount2 = 0;
	this.graffCount3 = 0;
	this.graffCount4 = 0;
	this.graffCount5 = 0;
	this.graffCount6 = 0;
	this.graffCount7 = 0;
	this.graffCount8 = 0;
	this.graffMax = 30;

	this.webSocket = function () {
		this.webSocketIndef = libWebSocket({
			server: window.location.href.replace('http', 'ws'),
			debug: debug,
			open: function () {
			},
			message: function (data) {
				var chart,
					time = (new Date()).getTime();

				if (data.event === 'quantity') {
					$('#stats-connections').html(
						'online: ' + data.quantityOnline +
						' / connections: ' + data.quantityConnection
					);
				}

				if (data.event === 'stats') {
					$('#stats-server').html(
						'server stats: ' +
						'rss ' + (data.mem.rss / 1024 / 1024).toFixed(2) + ' mb. / ' +
						'heapTotal ' + (data.mem.heapTotal / 1024 / 1024).toFixed(2) + ' mb. / ' +
						'heapUsed ' + (data.mem.heapUsed / 1024 / 1024).toFixed(2) + ' mb.'
					);
				}

				if (data.event === 'pong') {
					$('#stats-ping-pong').html(' / ping pong: ' + ((new Date()) - data.time) + ' ms');
				}

				if (data.event === 'bandwidth') {
					chart = $('#bandwidth').highcharts();
					if (!chart)
						return false;

					++self.graffCount1;
					data.charts.forEach(function (e, k) {
						chart.series[k].addPoint([time, Math.round(e.val)], true, (self.graffCount1 >= self.graffMax));
					});
				}

				if (data.event === 'io-disk') {
					chart = $('#io-disk').highcharts();
					if (!chart)
						return false;

					data.io = Math.round(data.io);
					var io = ('000' + data.io.toString()).substring(data.io.toString().length);
					chart.setTitle({text: 'Disks I/O: ' + io + ' %'});

					++self.graffCount2
					data.charts.forEach(function (e, k) {
						chart.series[k].addPoint([time, Math.round(e.val)], true, (self.graffCount2 >= self.graffMax));
					});
				}

				if (data.event === 'memory') {
					chart = $('#ram').highcharts();
					if (!chart)
						return false;

					chart.setTitle({
						text: 'RAM: ' + Math.ceil(data.totalRam / 1024 / 1024) + ' GB'
							+ ' + Swap: ' + Math.ceil(data.totalSwap / 1024 / 1024) + ' GB'
					});
					chart.series[0].setData(data.charts, true);
				}

				if (data.event === 'cpu') {
					chart = $('#cpu').highcharts();
					if (!chart) {
						cpuHighchart(data.charts);
						return false;
					}

					chart.setTitle({text: 'Cores ' + data.charts.length + ' load: ' + data.avg + ' %'});

					++self.graffCount3;
					data.charts.forEach(function (percent, k) {
						chart.series[k].addPoint([time, percent], true, (self.graffCount3 >= self.graffMax), true);
					});
				}

				if (data.event === 'space') {
					chart = $('#space').highcharts();
					if (!chart)
						return false;

					var total = '';
					if (total < 1024 * 1024) {
						total = Math.ceil(data.total / 1024) + ' GB';
					} else {
						total = Math.ceil(data.total / 1024 / 1024) + ' TB';
					}

					chart.setTitle({text: 'Space: ' + total});

					var section = {};
					var categories = [];
					data.charts.forEach(function (e) {
						var g = e.name.split(': ');

						if (categories.indexOf(g[1]) === -1)
							categories.push(g[1]);

						if (!(g[0] in section))
							section[g[0]] = [];

						section[g[0]].push(parseFloat(e.size));
					});

					chart.xAxis[0].update({
						categories: categories
					});

					var k = 0;
					Object.keys(section).forEach(function (key) {
						chart.series[k++].setData(section[key], true);
					});
				}

				if (data.event === 'mysql') {
					chart = $('#mysql').highcharts();

					if (!chart) {
						if (data.charts['queries'].length > 0)
							$('#mysql').show();

						mysqlHighchart(data.charts['queries']);
						return false;
					}

					chart.setTitle({text: 'MySQL Sent: ' + self.formatter(data.charts['traffic']['bytes sent'])});

					++self.graffCount4;
					data.charts['queries'].forEach(function (e, k) {
						chart.series[k].addPoint([time, e.v], true, (self.graffCount4 >= self.graffMax), true);
					});
				}

				if (data.event === 'redis') {
					chart = $('#redis').highcharts();

					if (!chart) {
						if (data.charts['queries'].length > 0)
							$('#redis').show();

						redisHighchart(data.charts['queries']);
						return false;
					}

					chart.setTitle({
						text: 'Redis: ' + (data.charts.memory / 1024 / 1024).toFixed(2) + ' MB used'
					});

					++self.graffCount5;
					data.charts['queries'].forEach(function (e, k) {
						chart.series[k].addPoint([time, e.v], true, (self.graffCount5 >= self.graffMax), true);
					});
				}

				if (data.event === 'pg-bouncer') {
					chart = $('#pg-bouncer').highcharts();
					if (!chart) {
						if (data.charts.queries.length > 0)
							$('#pg-bouncer').show();

						pgBouncerHighchart(data.charts.queries);
						return false;
					}

					chart.setTitle({text: 'PgBouncer Sent: ' + self.formatter(data.charts.sent)});

					++self.graffCount6;
					data.charts.queries.forEach(function (e, k) {
						chart.series[k].addPoint([time, e.v], true, (self.graffCount6 >= self.graffMax), true);
					});
				}

				if (data.event === 'nginx') {
					chart = $('#nginx').highcharts();
					if (!chart) {
						if (data.charts.length > 0)
							$('#nginx').show();

						nginxHighchart(data.charts);
						return false;
					}

					++self.graffCount7;
					data.charts.forEach(function (e, k) {
						chart.series[k].addPoint([time, parseFloat(e[1])], true,
							(self.graffCount7 >= self.graffMax), true);

						if (e[0] === 'requests')
							chart.setTitle({text: 'Nginx: ' + e[1] + ' req/s'});
					});
				}

				if (data.event === 'fpm') {
					chart = $('#fpm').highcharts();
					if (!chart) {
						if (data.charts.length > 0)
							$('#fpm').show();

						fpmHighchart(data.charts);
						return false;
					}

					++self.graffCount8;
					data.charts.forEach(function (e, k) {
						var val = parseFloat(e[1]);

						if (e[0] === 'runtime avg') {
							chart.setTitle({text: 'FPM: ' + val});
							if (val > 3600)
								val = 0;
						}

						chart.series[k].addPoint([time, val], true,
							(self.graffCount8 >= self.graffMax), true);
					});
				}
			}
		});
	};

	this.formatter = function (val) {
		if (val > 1024 * 1024) {
			return (val / 1024 / 1024).toFixed(1) + ' MB/s';
		} else {
			return (val / 1024).toFixed(1) + ' KB/s';
		}
	};

	return this;
}());

var libWebSocket = function (o) {
	return new function (o) {
		var self = this;
		this.init = function () {
			if (!o.server)
				return;
			this.debug = o.debug || false;
			this.reconnectTimeMin = o.reconnectTimeMin || 1;
			this.reconnectTimeMax = o.reconnectTimeMax || 2;
			try {
				self.socket = new WebSocket(o.server);
			} catch (e) {
				self.socket = {};
			}
			this.work = false;
			this.id = null;
			this.socket.onopen = function () {
				self.work = true;
				self.log('Соединение установлено.');

				window.setTimeout(function () {
					if (o.open)
						o.open(self);
				}, 100);
			};

			this.socket.onclose = function (event) {
				self.work = false;

				var resec = Math.floor(Math.random() * (self.reconnectTimeMax - self.reconnectTimeMin + 1)) + self.reconnectTimeMin;
				window.setTimeout(function () {
					self.init(o);
				}, resec * 1000);

				if (event.wasClean) {
					self.log('Соединение закрыто чисто');
				} else {
					self.log('Обрыв соединения');
				}
				self.log('Код: ' + event.code + ' причина: ' + event.reason);

				self.log('Переподключение через ' + resec + ' сек.');

				if (o.close)
					o.close(self);
			};

			this.socket.onmessage = function (event) {
				self.log('Получены данные ' + event.data);

				var obj = JSON.parse(event.data);

				if (!self.id && obj.id)
					self.id = obj.id;

				if (!obj.data)
					return;

				if (o.message)
					o.message(obj.data);
			};

			this.socket.onerror = function (error) {
				self.log('Ошибка ' + error.message);
			};

			return this;
		};

		this.send = function (command, message) {
			if (!this.work)
				return;
			this.socket.send(JSON.stringify({
				command: command,
				time: (new Date).getTime(),
				data: message,
				id: this.id
			}));
		};

		this.log = function (message) {
			if (this.debug)
				console.log(message);
		};

		return this.init();

	}(o);
};

$(function () {
	Highcharts.setOptions({
		global: {
			useUTC: false
		},
		colors: [
			'#7cb5ec', '#ff9f0a', '#ff375f', '#eae',
			'#f45b5b', '#64d2ff', '#ffd60a', '#bf5af2',
			'#30d158', '#b381b3', '#aee', '#dddf0d'
		],
		tooltip: {
			borderWidth: 0,
			backgroundColor: 'rgba(230,230,230,0.8)',
			shadow: false
		},
		plotOptions: {
			candlestick: {
				lineColor: '#404048'
			},
			spline: {
				connectNulls: true
			}
		},
		background2: '#f0f0ea'
	});

	// bandwidth
	new Highcharts.Chart({
		chart: {
			renderTo: 'bandwidth',
			type: 'spline',
			marginRight: 30,
			animation: Highcharts.svg
		},
		title: {
			text: 'Bandwidth'
		},
		xAxis: {
			type: 'datetime',
			tickPixelInterval: 150
		},
		yAxis: {
			title: {
				text: 'traffic in sec'
			},
			plotLines: [{
				value: 0,
				width: 1,
				color: '#808080'
			}],
			labels: {
				formatter: function () {
					var maxElement = this.axis.max;
					if (maxElement > 1024) {
						return (this.value / 1024).toFixed(1) + ' Mbps';
					} else {
						return (this.value) + ' Kbps';
					}
				}
			},
			min: 0,
			tickPixelInterval: 25
		},
		legend: {
			enabled: true
		},
		plotOptions: {
			series: {
				marker: {
					enabled: false
				},
				states: {
					hover: {
						enabled: false
					}
				}
			}
		},
		series: [{
			name: 'in',
			type: 'spline',
			data: [],
			color: '#ff8700',
			tooltip: {
				valueDecimals: 0
			}
		}, {
			name: 'out',
			data: [],
			type: 'spline',
			color: 'grey',
			tooltip: {
				valueDecimals: 0
			}
		}]
	});

	// io-disk
	new Highcharts.Chart({
		chart: {
			renderTo: 'io-disk',
			type: 'spline',
			marginRight: 30,
			animation: Highcharts.svg
		},
		title: {
			text: 'Disks I/O'
		},
		xAxis: {
			type: 'datetime',
			tickPixelInterval: 150
		},
		yAxis: {
			title: {
				text: 'speed'
			},
			plotLines: [{
				value: 0,
				width: 1,
				color: '#808080'
			}],
			min: 0,
			tickPixelInterval: 25
		},
		legend: {
			enabled: true
		},
		plotOptions: {
			series: {
				marker: {
					enabled: false
				},
				states: {
					hover: {
						enabled: false
					}
				}
			}
		},
		series: [{
			name: 'read',
			type: 'spline',
			data: [],
			color: 'grey',
			tooltip: {
				valueDecimals: 0
			}
		}, {
			name: 'write:',
			type: 'spline',
			data: [],
			color: '#ff4500',
			tooltip: {
				valueDecimals: 0
			}
		}]
	});

	// ram
	new Highcharts.Chart({
		chart: {
			renderTo: 'ram',
			plotBackgroundColor: null,
			plotBorderWidth: null,
			plotShadow: false,
			type: 'pie'
		},
		title: {
			text: 'RAM ... GB + Swap ... GB'
		},
		tooltip: {
			enabled: false
		},
		plotOptions: {
			pie: {
				allowPointSelect: false,
				dataLabels: {
					enabled: true,
					format: '{point.name}: {point.percentage:.1f} %<br> <span style="color: grey;">size: {point.size} GB</span>'
				},
				size: 130,
				legend: true,
				innerSize: '50%',
				showInLegend: true
			}
		},
		series: [{
			name: 'RAM',
			colorByPoint: true,
			data: []
		}]
	});

	// cpu
	window.cpuHighchart = function (charts) {
		var series = [];
		charts.forEach(function (_, k) {
			series.push({
				name: ++k,
				data: []
			});
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'cpu',
				type: 'spline',
				marginRight: 30,
				animation: Highcharts.svg
			},
			title: {
				text: 'Load CPU'
			},
			xAxis: {
				type: 'datetime',
				tickPixelInterval: 150
			},
			yAxis: {
				title: {
					text: 'load'
				},
				plotLines: [{
					value: 0,
					width: 1,
					color: '#808080'
				}],
				labels: {
					formatter: function () {
						return this.value + '%';
					}
				},
				min: 0,
				max: 100,
				tickPixelInterval: 25
			},
			legend: {
				enabled: true,
				maxHeight: 55
			},
			plotOptions: {
				series: {
					marker: {
						enabled: false
					},
					states: {
						hover: {
							enabled: false
						}
					}
				}
			},
			series: series
		});
	};

	// space
	new Highcharts.Chart({
		chart: {
			renderTo: 'space',
			type: 'bar'
		},
		title: {
			text: 'Space ... TB'
		},
		yAxis: {
			min: 0,
			title: {
				text: 'GB'
			}
		},
		legend: {
			reversed: true
		},
		tooltip: {
			enabled: false
		},
		plotOptions: {
			series: {
				stacking: 'normal'
			},
			bar: {
				dataLabels: {
					enabled: true
				}
			}
		},
		series: [{
			name: 'Free',
			data: []
		},{
			name: 'Used',
			data: []
		}]
	});

	// mysql
	window.mysqlHighchart = function (charts) {
		var series = [];
		charts.forEach(function (e) {
			series.push({
				name: e.k,
				data: []
			});
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'mysql',
				type: 'spline',
				marginRight: 30,
				animation: Highcharts.svg
			},
			title: {
				text: 'MySQL'
			},
			xAxis: {
				type: 'datetime',
				tickPixelInterval: 150
			},
			yAxis: {
				title: {
					text: 'quantity'
				},
				plotLines: [{
					value: 0,
					width: 1,
					color: '#808080'
				}],
				labels: {
					formatter: function () {
						return this.value;
					}
				},
				min: 0,
				tickPixelInterval: 25
			},
			legend: {
				enabled: true,
				alignColumns: false
			},
			plotOptions: {
				series: {
					marker: {
						enabled: false
					},
					states: {
						hover: {
							enabled: false
						}
					}
				}
			},
			series: series
		});
	};

	// redis
	window.redisHighchart = function (charts) {
		var series = [];
		charts.forEach(function (e) {
			series.push({
				name: e.k,
				data: []
			});
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'redis',
				type: 'spline',
				marginRight: 30,
				animation: Highcharts.svg
			},
			title: {
				text: 'Redis'
			},
			xAxis: {
				type: 'datetime',
				tickPixelInterval: 150
			},
			yAxis: {
				title: {
					text: 'quantity'
				},
				plotLines: [{
					value: 0,
					width: 1,
					color: '#808080'
				}],
				labels: {
					formatter: function () {
						return this.value;
					}
				},
				min: 0,
				tickPixelInterval: 25
			},
			legend: {
				enabled: true
			},
			plotOptions: {
				series: {
					marker: {
						enabled: false
					},
					states: {
						hover: {
							enabled: false
						}
					}
				}
			},
			series: series
		});
	};

	// pg-bouncer
	window.pgBouncerHighchart = function (charts) {
		var series = [];
		charts.forEach(function (e) {
			series.push({
				name: e.k,
				data: []
			});
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'pg-bouncer',
				type: 'spline',
				animation: Highcharts.svg
			},
			title: {
				text: 'PgBouncer'
			},
			xAxis: {
				type: 'datetime',
				tickPixelInterval: 150
			},
			yAxis: {
				title: {
					text: 'quantity'
				},
				plotLines: [{
					value: 0,
					width: 1,
					color: '#808080'
				}],
				labels: {
					formatter: function () {
						return this.value;
					}
				},
				min: 0,
				tickPixelInterval: 25
			},
			legend: {
				enabled: true
			},
			plotOptions: {
				series: {
					marker: {
						enabled: false
					},
					states: {
						hover: {
							enabled: false
						}
					}
				}
			},
			series: series
		});
	};

	// nginx
	window.nginxHighchart = function (charts) {
		var series = [];
		charts.forEach(function (e) {
			series.push({
				name: e[0],
				data: []
			});
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'nginx',
				type: 'spline',
				animation: Highcharts.svg
			},
			title: {
				text: 'Nginx'
			},
			xAxis: {
				type: 'datetime',
				tickPixelInterval: 150
			},
			yAxis: {
				title: {
					text: 'quantity'
				},
				plotLines: [{
					value: 0,
					width: 1,
					color: '#808080'
				}],
				labels: {
					formatter: function () {
						return this.value;
					}
				},
				min: 0,
				tickPixelInterval: 25
			},
			legend: {
				enabled: true
			},
			plotOptions: {
				series: {
					marker: {
						enabled: false
					},
					states: {
						hover: {
							enabled: false
						}
					}
				}
			},
			series: series
		});
	};

	// fpm
	window.fpmHighchart = function (charts) {
		var series = [];
		charts.forEach(function (e) {
			series.push({
				name: e[0],
				data: []
			});
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'fpm',
				type: 'spline',
				animation: Highcharts.svg
			},
			title: {
				text: 'FPM'
			},
			xAxis: {
				type: 'datetime',
				tickPixelInterval: 150
			},
			yAxis: {
				title: {
					text: 'quantity'
				},
				plotLines: [{
					value: 0,
					width: 1,
					color: '#808080'
				}],
				labels: {
					formatter: function () {
						return this.value;
					}
				},
				min: 0,
				tickPixelInterval: 25
			},
			legend: {
				enabled: true
			},
			plotOptions: {
				series: {
					marker: {
						enabled: false
					},
					states: {
						hover: {
							enabled: false
						}
					}
				}
			},
			series: series
		});
	};

	// run
	highLoad.webSocket();

	window.setInterval(function () {
		if (highLoad.webSocketIndef) {
			highLoad.webSocketIndef.send('stats');
			highLoad.webSocketIndef.send('ping');
		}
	}, 1000);
});