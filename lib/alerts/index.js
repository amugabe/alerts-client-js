var AlertManager = require('./AlertManager');

var timezone = require('./../common/lang/timezone');

module.exports = (() => {
	'use strict';

	return {
		AlertManager: AlertManager,
		timezone: timezone,
		version: '1.4.7'
	};
})();