var highLoad = (function () {

	this.init = {
		memory: null,
		space: null,
		mysql: null,
		redis: null,
		postgres: null,
		pgBouncer: null
	};

	this.data = {
		'bandwidth': {},
		'io-disk': {},
		'memory': {},
		'cpu': [],
		'space': {},
		'mysql': [],
		'redis': [],
		'pg-bouncer': []
	};

	this.get = function () {
		$.get(window.location.href + '.db', function (db) {

			var jsons = db.split("\n");

			jsons.forEach(function (j) {
				if (j === '')
					return;

				var e = JSON.parse(j);

				switch (e.e) {
					case 'bandwidth':
					case 'io-disk':
						e.d.forEach(function (v, k) {
							if (!(k in self.data[e.e]))
								self.data[e.e][k] = [];
							self.data[e.e][k].push([e.t, Math.round(v)]);
						});
						break;

					case 'memory':
						if (!init.memory)
							init.memory = e.d;

						e.d.charts.forEach(function (v, k) {
							if (!(k in self.data[e.e]))
								self.data[e.e][k] = [];
							self.data[e.e][k].push([e.t, parseFloat(v.size)]);
						});
						break;

					case 'cpu':
						self.data[e.e].push([e.t, parseFloat(e.d)]);
						break;

					case 'space':
						if (!init.space)
							init.space = e.d;

						e.d.charts.forEach(function (v, k) {
							if (!(k in self.data[e.e]))
								self.data[e.e][k] = [];
							self.data[e.e][k].push([e.t, parseFloat(v.size)]);
						});
						break;

					case 'mysql':
						if (!init.mysql)
							init.mysql = e.d;

						e.d.forEach(function (v, k) {
							if (!(k in self.data[e.e]))
								self.data[e.e][k] = [];
							self.data[e.e][k].push([e.t, +v.v]);
						});
						break;

					case 'redis':
						if (!init.redis)
							init.redis = e.d;

						e.d.forEach(function (v, k) {
							if (!(k in self.data[e.e]))
								self.data[e.e][k] = [];
							self.data[e.e][k].push([e.t, +v.v]);
						});
						break;

					case 'pg-bouncer':
						init.pgBouncer = e.d;

						e.d.forEach(function (v, k) {
							if (!(k in self.data[e.e]))
								self.data[e.e][k] = [];
							self.data[e.e][k].push([e.t, +v.v]);
						});
						break;
				}
			});

			window.bandwidthHighchart();
			window.ioDiskHighchart();
			window.memoryHighchart();
			window.cpuHighchart();
			window.spaceHighchart();
			window.mysqlHighchart();
			window.redisHighchart();
			window.pgBouncerHighchart();

			$('#loading').hide();
		});
	};

	return this;
}());

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
	window.bandwidthHighchart = function () {
		var data = highLoad.data['bandwidth'];
		new Highcharts.Chart({
			chart: {
				renderTo: 'bandwidth',
				type: 'spline',
				animation: Highcharts.svg,
				zoomType: 'x'
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
					lineWidth: 1.5,
					marker: {
						enabled: false
					},
					states: {
						hover: {
							enabled: false
						}
					},
					dataGrouping: {
						approximation: 'average',
						units: [
							['minute', [1]]
						],
						forced: true,
						enabled: true,
						groupAll: true
					}
				}
			},
			series: [{
				name: 'in',
				type: 'spline',
				data: data[0],
				color: '#ff8700',
				tooltip: {
					valueDecimals: 0
				}
			}, {
				name: 'out',
				data: data[1],
				type: 'spline',
				color: 'grey',
				tooltip: {
					valueDecimals: 0
				}
			}]
		});
	};

	// io-disk
	window.ioDiskHighchart = function () {
		var data = highLoad.data['io-disk'];

		new Highcharts.Chart({
			chart: {
				renderTo: 'io-disk',
				type: 'spline',
				animation: Highcharts.svg,
				zoomType: 'x'
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
					lineWidth: 1.5,
					marker: {
						enabled: false
					},
					states: {
						hover: {
							enabled: false
						}
					},
					dataGrouping: {
						approximation: 'average',
						units: [
							['minute', [1]]
						],
						forced: true,
						enabled: true,
						groupAll: true
					}
				}
			},
			series: [{
				name: 'read',
				type: 'spline',
				data: data[0],
				color: 'grey',
				tooltip: {
					valueDecimals: 0
				}
			}, {
				name: 'write:',
				type: 'spline',
				data: data[1],
				color: '#ff8700',
				tooltip: {
					valueDecimals: 0
				}
			}, {
				name: 'load i/o:',
				type: 'spline',
				data: data[2],
				color: '#ff4500',
				tooltip: {
					valueDecimals: 0
				}
			}]
		});
	};

	// memory
	window.memoryHighchart = function () {
		var data = highLoad.data['memory'];
		var memory = highLoad.init.memory;
		var series = [];
		memory.charts.forEach(function (e, k) {
			series.push({
				name: e.name,
				data: data[k]
			});
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'memory',
				type: 'spline',
				animation: Highcharts.svg,
				zoomType: 'x'
			},
			title: {
				text: 'Ram ' + Math.ceil(memory.totalRam / 1024 / 1024) + ' GB'
					+ (memory.totalSwap > 0 ? ' + Swap ' + Math.ceil(memory.totalSwap / 1024 / 1024) + ' GB' : '')
			},
			xAxis: {
				type: 'datetime',
				tickPixelInterval: 150
			},
			yAxis: {
				title: {
					text: 'size'
				},
				plotLines: [{
					value: 0,
					width: 1,
					color: '#808080'
				}],
				labels: {
					formatter: function () {
						return this.value + ' GB';
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
					lineWidth: 1.5,
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

	// cpu
	window.cpuHighchart = function () {
		var data = highLoad.data['cpu'];
		var series = [];

		series.push({
			type: 'area',
			name: 'avg cores',
			data: data
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'cpu',
				type: 'spline',
				animation: Highcharts.svg,
				zoomType: 'x'
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
				enabled: false
			},
			plotOptions: {
				area: {
					lineWidth: 0.5
				},
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
	window.spaceHighchart = function () {
		var data = highLoad.data['space'];
		var space = highLoad.init.space;
		var series = [];
		space.charts.forEach(function (e, k) {
			series.push({
				name: e.name,
				data: data[k]
			});
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'space',
				type: 'spline',
				animation: Highcharts.svg,
				zoomType: 'x'
			},
			title: {
				text: 'Space ' + Math.ceil(space.total / 1024 / 1024) + ' TB'
			},
			xAxis: {
				type: 'datetime',
				tickPixelInterval: 150
			},
			yAxis: {
				title: {
					text: 'size'
				},
				plotLines: [{
					value: 0,
					width: 1,
					color: '#808080'
				}],
				labels: {
					formatter: function () {
						return this.value + ' GB';
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

	// mysql
	window.mysqlHighchart = function () {
		if (!init.mysql)
			return;

		var data = highLoad.data['mysql'];
		var series = [];
		init.mysql.forEach(function (e, k) {
			series.push({
				type: 'area',
				name: e.k,
				data: data[k],
				zIndex: e.k === 'queries' ? 1 : 2
			});

			$('#mysql').show();
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'mysql',
				type: 'spline',
				animation: Highcharts.svg,
				zoomType: 'x'
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
				enabled: true
			},
			plotOptions: {
				area: {
					lineWidth: 0.5
				},
				series: {
					lineWidth: 0.5,
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
	window.redisHighchart = function () {
		if (!init.redis)
			return;

		var data = highLoad.data['redis'];
		var series = [];
		init.redis.forEach(function (e, k) {
			series.push({
				name: e.k,
				data: data[k]
			});

			$('#redis').show();
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'redis',
				type: 'spline',
				animation: Highcharts.svg,
				zoomType: 'x'
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
					lineWidth: 0.8,
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

	window.pgBouncerHighchart = function () {
		if (!init.pgBouncer)
			return;

		var data = highLoad.data['pg-bouncer'];
		var series = [];
		init.pgBouncer.forEach(function (e, k) {
			series.push({
				name: e.k,
				data: data[k]
			});

			$('#pg-bouncer').show();
		});

		new Highcharts.Chart({
			chart: {
				renderTo: 'pg-bouncer',
				type: 'spline',
				animation: Highcharts.svg,
				zoomType: 'x'
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
					lineWidth: 0.8,
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
	highLoad.get();
});