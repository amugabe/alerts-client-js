var AlertManager = require('./AlertManager');
var RestAlertManager = require('./RestAlertManager');
var SocketIOAlertManager = require('./SocketIOAlertManager');

var timezone = require('./../common/lang/timezone');

module.exports = (() => {
	'use strict';

	return {
		AlertManager: AlertManager,
		RestAlertManager: RestAlertManager,
		SocketIOAlertManager: SocketIOAlertManager,
		timezone: timezone,
		version: '1.3.13'
	};
})();