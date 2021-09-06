/**
 * Print information by group
 *
 * @param type
 * @param msg
 * @returns {boolean}
 */
module.exports.log = function (type, msg) {
	if (!module.exports.debug && (type === 'debug' || type === 'msg'))
		return false;

	let color = '\u001b[0m',
		reset = '\u001b[0m';

	switch (type) {
		case 'info':
			color = '\u001b[36m';
			break;
		case 'warn':
			color = '\u001b[33m';
			break;
		case 'error':
			color = '\u001b[31m';
			break;
		case 'msg':
			color = '\u001b[34m';
			break;
		case 'debug':
			color = '\u001B[35m';
			break;
		default:
			color = '\u001b[0m'
	}

	console.log('[' + (new Date()).toLocaleString() + '] [' + color + type + reset + '] ' + msg);

	return true;
};
module.exports.debug = false;