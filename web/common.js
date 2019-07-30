var highLoad = (function () {

	this.webSocketIndef = null;
	this.graffCount1 = 0;
	this.graffCount2 = 0;
	this.graffCount3 = 0;
	this.graffCount4 = 0;
	this.graffCount5 = 0;
	this.graffMax = 30;
	this.webSocket = function () {
		this.webSocketIndef = libWebSocket({
			server: window.location.href.replace('http', 'ws'),
			debug: false,
			open: function () {
			},
			message: function (data) {
				var chart, time;

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

				if (data.event === 'io-disk') {
					chart = $('#io-disk').highcharts();
					if (!chart)
						return false;

					time = (new Date()).getTime();

					chart.series[0].addPoint([time, Math.round(data.read)], true, (++self.graffCount1 >= self.graffMax));
					chart.series[1].addPoint([time, Math.round(data.write)], true, (self.graffCount1 >= self.graffMax));
				}

				if (data.event === 'bandwidth') {
					chart = $('#bandwidth').highcharts();
					if (!chart)
						return false;

					time = (new Date()).getTime();

					chart.series[0].addPoint([time, Math.round(data.out)], true, (++self.graffCount2 >= self.graffMax));
					chart.series[1].addPoint([time, Math.round(data.in)], true, (self.graffCount2 >= self.graffMax));
				}

				if (data.event === 'memory') {
					chart = $('#ram').highcharts();
					if (!chart)
						return false;
					chart.series[0].setData(data.ram, true);
				}

				if (data.event === 'cpu') {
					chart = $('#cpu').highcharts();
					if (!chart) {
						cpuHighchart(Object.keys(data.list).length);
						return false;
					}

					time = (new Date()).getTime();

					++self.graffCount3;
					$.each(data.list, function (num, percent) {
						chart.series[--num].addPoint([time, percent], true, (self.graffCount3 >= self.graffMax), true);
					});
				}

				if (data.event === 'space') {
					chart = $('#space').highcharts();
					if (!chart)
						return false;
					chart.series[0].setData(data.space, true);
				}

				if (data.event === 'mysql') {
					chart = $('#mysql-queries').highcharts();

					if (!chart) {
						var keys = Object.keys(data.list['queries']);
						if (keys.length > 0)
							$('#mysql-queries').show();

						mysqlQueriesHighchart(keys);
						return false;
					}

					time = (new Date()).getTime();

					++self.graffCount4;
					num = 0;
					$.each(data.list['queries'], function (name, val) {
						chart.series[num++].addPoint([time, val], true, (self.graffCount4 >= self.graffMax), true);
					});
				}

				if (data.event === 'mysql') {
					chart = $('#mysql-traffic').highcharts();

					if (!chart) {
						var keys = Object.keys(data.list['traffic']);
						if (keys.length > 0)
							$('#mysql-traffic').show();

						mysqlTrafficHighchart(keys);
						return false;
					}

					time = (new Date()).getTime();

					++self.graffCount4;
					num = 0;
					$.each(data.list['traffic'], function (name, val) {
						chart.series[num++].addPoint([time, val], true, (self.graffCount4 >= self.graffMax), true);
					});
				}

				if (data.event === 'redis') {
					chart = $('#redis-queries').highcharts();

					if (!chart) {
						var keys = Object.keys(data.list['queries']);
						if (keys.length > 0)
							$('#redis-queries').show();

						redisQueriesHighchart(keys);
						return false;
					}

					time = (new Date()).getTime();

					++self.graffCount5;
					num = 0;
					$.each(data.list['queries'], function (name, val) {
						chart.series[num++].addPoint([time, val], true, (self.graffCount5 >= self.graffMax), true);
					});
				}
			}
		});
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
		colors: ["#7cb5ec", "#f7a35c", "#90ee7e", "#7798BF", "#aaeeee", "#ff0066", "#eeaaee",
			"#55BF3B", "#DF5353", "#7798BF", "#aaeeee"],
		tooltip: {
			borderWidth: 0,
			backgroundColor: 'rgba(219,219,216,0.8)',
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
		background2: '#F0F0EA'
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
			name: 'out',
			data: [],
			type: 'spline',
			color: 'grey',
			tooltip: {
				valueDecimals: 0
			}
		}, {
			name: 'in',
			type: 'spline',
			data: [],
			color: '#FF8700',
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
			text: 'I/O Disk'
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
			color: '#FF4500',
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
			text: 'RAM + SWAP'
		},
		tooltip: {
			enabled: false
		},
		plotOptions: {
			pie: {
				allowPointSelect: false,
				dataLabels: {
					enabled: true,
					format: '{point.name}: {point.percentage:.1f} %<br> <span style="color: grey;">size: {point.size} mb.</span>'
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
	window.cpuHighchart = function (quantity) {
		var series = [];
		for (var i = 1; i <= quantity; i++) {
			series.push({
				name: 'core ' + i,
				data: []
			});
		}

		new Highcharts.Chart({
			chart: {
				renderTo: 'cpu',
				type: 'spline',
				marginRight: 30,
				animation: Highcharts.svg
			},
			title: {
				text: 'Load CPU cores'
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

	// space
	new Highcharts.Chart({
		chart: {
			renderTo: 'space',
			plotBackgroundColor: null,
			plotBorderWidth: null,
			plotShadow: false,
			type: 'pie'
		},
		title: {
			text: 'Space'
		},
		tooltip: {
			enabled: false
		},
		plotOptions: {
			pie: {
				allowPointSelect: false,
				dataLabels: {
					enabled: true,
					format: '{point.name}: {point.percentage:.1f} %<br> <span style="color: grey;">size: {point.size} gb.</span>'
				},
				size: 130,
				legend: true,
				innerSize: '50%',
				showInLegend: true
			}
		},
		series: [{
			name: 'Space',
			colorByPoint: true,
			data: []
		}]
	});

	// mysql queries
	window.mysqlQueriesHighchart = function (structure) {
		var series = [];
		structure.forEach(function (name) {
			series.push({
				name: name,
				data: []
			});
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'mysql-queries',
				type: 'spline',
				marginRight: 30,
				animation: Highcharts.svg
			},
			title: {
				text: 'MySQL Queries'
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

	// mysql traffic
	window.mysqlTrafficHighchart = function (structure) {
		var series = [];
		structure.forEach(function (name) {
			series.push({
				name: name,
				data: []
			});
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'mysql-traffic',
				type: 'spline',
				marginRight: 30,
				animation: Highcharts.svg
			},
			title: {
				text: 'MySQL Traffic'
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
						if (maxElement > 1024 * 1024) {
							return (this.value / 1024 / 1024).toFixed(1) + ' MB/s';
						} else if (maxElement > 1024) {
							return (this.value / 1024).toFixed(1) + ' KB/s';
						} else {
							return (this.value) + ' Bytes';
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
			series: series
		});
	};

	// redis queries
	window.redisQueriesHighchart = function (structure) {
		var series = [];
		structure.forEach(function (name) {
			series.push({
				name: name,
				data: []
			});
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'redis-queries',
				type: 'spline',
				marginRight: 30,
				animation: Highcharts.svg
			},
			title: {
				text: 'Redis Queries'
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