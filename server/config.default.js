module.exports = {
	web: {
		host: '0.0.0.0',
		port: 8039
	},
	collector: {
		host: '0.0.0.0',
		port: 3939,

		/**
		 * List ipv4 addresses allowing push stats from hgls-collector
		 */
		allowIps: [
			'127.0.0.1',
		]
	}
};