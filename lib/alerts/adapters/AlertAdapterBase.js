var Disposable = require('./../common/lang/Disposable');

module.exports = (() => {
	'use strict';

	class AlertAdapterBase extends Disposable {
		constructor() {
			super();
		}

		connect() {
			return null;
		}

		createAlert(alert) {
			return  null;
		}

		retrieveAlert(alert) {
			return null;
		}

		enableAlert(alert) {
			return null;
		}

		disableAlert(alert) {
			return null;
		}

		deleteAlert(alert) {
			return null;
		}

		retrieveAlerts(query) {
			return null;
		}

		subscribeAlerts(query, changeCallback, deleteCallback) {
			return null;
		}

		getTargets() {
			return null;
		}

		getProperties() {
			return null;
		}

		getOperators() {
			return null;
		}

		getPublisherTypes() {
			return null;
		}

		getPublisherTypeDefaults(query) {
			return null;
		}

		assignPublisherTypeDefault(query) {
			return null;
		}

		getMarketDataConfiguration(query) {
			return null;
		}

		assignMarketDataConfiguration(query) {
			return null;
		}

		getServerVersion() {
			return null;
		}

		toString() {
			return '[AlertManagerBase]';
		}
	}

	return AlertManagerBase;
})();