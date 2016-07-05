var assert = require('./../common/lang/assert');
var Disposable = require('./../common/lang/Disposable');
var Event = require('./../common/messaging/Event');

var validate = require('./../validators/validate');

var RestAlertAdapter = require('./adapters/RestAlertAdapter');
var SocketAlertAdapter = require('./adapters/SocketAlertAdapter');

module.exports = (() => {
	'use strict';

	class AlertManager extends Disposable {
		constructor(host, port, secure, mode) {
			super();

			assert.argumentIsOptional(host, 'host', String);
			assert.argumentIsOptional(port, 'port', Number);
			assert.argumentIsOptional(secure, 'secure', Boolean);
			assert.argumentIsOptional(mode, 'mode', String);

			let adapter;

			if (mode === 'rest') {
				adapter = new RestAlertAdapter(host, port, secure);
			} else {
				adapter = new SocketAlertAdapter(host, port, secure);
			}

			this._adapter = adapter;

			this._alertSubscriptionMap = {};
		}

		connect() {
			var that = this;

			return Promise.resolve()
				.then(() => {
					return this._adapter.connect();
				});
		}

		createAlert(alert) {
			validate.alert.forCreate(alert);

			return Promise.resolve()
				.then(() => {
					return this._adapter.createAlert(alert);
				});
		}

		retrieveAlert(alert) {
			validate.alert.forQuery(alert);

			return Promise.resolve()
				.then(() => {
					return this._adapter.retrieveAlert(alert);
				});
		}

		editAlert(alert) {
			validate.alert.forEdit(alert);

			return Promise.resolve()
				.then(() => {
					return this._adapter.deleteAlert(alert);
				}).then(() => {
					return this._adapter.createAlert(alert);
				});
		}

		enableAlert(alert) {
			validate.alert.forQuery(alert);

			const clone = _.clone(alert);
			clone.alert_state = 'Starting';

			onAlertMutated.call(this, clone);

			return Promise.resolve()
				.then(() => {
					return this._adapter.enableAlert({alert_id: alert.alert_id});
				});
		}

		disableAlert(alert) {
			validate.alert.forQuery(alert);

			const clone = _.clone(alert);
			clone.alert_state = 'Stopping';

			onAlertMutated.call(this, clone);

			return Promise.resolve()
				.then(() => {
					return this._adapter.enableAlert({alert_id: alert.alert_id});
				});
		}

		deleteAlert(alert) {
			validate.alert.forQuery(alert);

			return Promise.resolve()
				.then(() => {
					return this._adapter.deleteAlert({alert_id: alert.alert_id});
				});
		}

		retrieveAlerts(query) {
			validate.alert.forUser(query);

			var that = this;


			return Promise.resolve()
				.then(() => {
					return that._retrieveAlerts(query);
				}).then((results) => {
					if (query.filter && query.filter.alert_type) {
						return results.filter((result) => result.alert_type === query.filter.alert_type);
					} else {
						return results;
					}
				}).then((results) => {
					if (query.filter && query.filter.symbol) {
						return results.filter((result) => result.conditions.some((c) => (c.property.target.type === 'symbol' && c.property.target.identifier ===  query.filter.symbol) || (c.property.type === 'symbol' && c.operator.operand === query.filter.symbol)));
					} else {
						return results;
					}
				})

			return when.try(function() {
				var returnRef = that._retrieveAlerts(query);

				if (_.isObject(query.filter)) {
					if (_.isString(query.filter.alert_type)) {
						var alertType = query.filter.alert_type;

						returnRef = returnRef.then(function(alerts) {
							return _.filter(alerts, function(alert) {
								return alert.alert_type === alertType;
							});
						});
					}

					if (_.isString(query.filter.symbol)) {
						var symbol = query.filter.symbol;

						returnRef = returnRef.then(function(alerts) {
							return _.filter(alerts, function(alert) {
								return _.some(alert.conditions, function(condition) {
									return (condition.property.target.type === 'symbol' && condition.property.target.identifier === symbol) || (condition.property.type === 'symbol' && condition.operator.operand === symbol);
								});
							});
						});
					}

					if (_.isObject(query.filter.target) && _.isString(query.filter.target.identifier)) {
						var identifier = query.filter.target.identifier;

						returnRef = returnRef.then(function(alerts) {
							return _.filter(alerts, function(alert) {
								return _.some(alert.conditions, function(condition) {
									return condition.property.target.identifier === identifier;
								});
							});
						});
					}

					if (_.isObject(query.filter.condition) && (_.isString(query.filter.condition.operand) || _.isNumber(query.filter.condition.operand))) {
						var operand = query.filter.condition.operand;

						returnRef = returnRef.then(function(alerts) {
							return _.filter(alerts, function(alert) {
								return _.some(alert.conditions, function(condition) {
									return condition.operator.operand === operand.toString();
								});
							});
						});
					}
				}

				return returnRef;
			});
		}

		subscribeAlerts(query, changeCallback, deleteCallback) {
			assert.argumentIsRequired(query, query, Object);
			assert.argumentIsRequired(query.user_id, 'query.user_id', String);
			assert.argumentIsRequired(query.alert_system, 'query.alert_system', String);
			assert.argumentIsRequired(changeCallback, 'changeCallback', Function);
			assert.argumentIsRequired(deleteCallback, 'deleteCallback', Function);

			var userId = query.user_id;
			var alertSystem = query.alert_system;

			if (!_.has(this._alertSubscriptionMap, userId)) {
				this._alertSubscriptionMap[userId] = {};
			}

			if (!_.has(this._alertSubscriptionMap[userId], alertSystem)) {
				this._alertSubscriptionMap[userId][alertSystem] = {
					changeEvent: new Event(this),
					deleteEvent: new Event(this),
					subscribers: 0
				};
			}

			var subscriptionData = this._alertSubscriptionMap[userId][alertSystem];

			if (subscriptionData.subscribers === 0) {
				subscriptionData.implementationBinding = this._onSubscribeAlerts(query);
			}

			subscriptionData.subscribers = subscriptionData.subscribers + 1;

			var changeRegistration = subscriptionData.changeEvent.register(changeCallback);
			var deleteRegistration = subscriptionData.deleteEvent.register(deleteCallback);

			return Disposable.fromAction(function() {
				subscriptionData.subscribers = subscriptionData.subscribers - 1;

				if (subscriptionData.subscribers === 0) {
					subscriptionData.implementationBinding.dispose();
				}

				changeRegistration.dispose();
				deleteRegistration.dispose();
			});
		}

		_onAlertMutated(alert) {
			if (!_.isObject(alert)) {
				return;
			}

			var data = getMutationEvent(this._alertSubscriptionMap, alert);

			if (data) {
				data.changeEvent.fire(_.clone(alert, true));
			}
		}

		_onAlertDeleted(alert) {
			if (!_.isObject(alert)) {
				return;
			}

			var data = getMutationEvent(this._alertSubscriptionMap, alert);

			if (data) {
				data.deleteEvent.fire(alert);
			}
		}

		getTargets() {
			var that = this;

			return when.try(function() {
				return that._getTargets();
			});
		}

		getProperties() {
			var that = this;

			return when.try(function() {
				return that._getProperties();
			});
		}

		getOperators() {
			var that = this;

			return when.try(function() {
				return that._getOperators();
			});
		}

		getPublisherTypes() {
			var that = this;

			return when.try(function() {
				return that._getPublisherTypes();
			});
		}

		getPublisherTypeDefaults(query) {
			var that = this;

			return when.try(function() {
				return that._getPublisherTypeDefaults(query);
			});
		}

		_getPublisherTypeDefaults(query) {
			return null;
		}

		assignPublisherTypeDefault(query) {
			assert.argumentIsOptional(query.allow_timezone, 'query.allow_window_timezone', Boolean);
			assert.argumentIsOptional(query.allow_timezone, 'query.allow_window_start', String);
			assert.argumentIsOptional(query.allow_timezone, 'query.allow_window_end', String);

			if (query.allow_window_start === '') {
				query.allow_window_start = null;
			}

			if (query.allow_window_end === '') {
				query.allow_window_end = null;
			}

			if (_.isUndefined(query.active_alert_types) || _.isNull(query.active_alert_types)) {
				query.active_alert_types = [ ];
			}

			assert.argumentIsArray(query.active_alert_types, 'active_alert_types', String);

			var that = this;

			return when.try(function() {
				return that._assignPublisherTypeDefault(query);
			});
		}

		getMarketDataConfiguration(query) {
			var that = this;

			return when.try(function() {
				return that._getMarketDataConfiguration(query);
			});
		}

		assignMarketDataConfiguration(query) {
			var that = this;

			return when.try(function() {
				return that._assignMarketDataConfiguration(query);
			});
		}

		getServerVersion() {
			var that = this;

			return when.try(function() {
				return that._getServerVersion();
			});
		}

		toString() {
			return '[AlertManager]';
		}
	}

	function getMutationEvent(map, alert) {
		var returnRef = null;

		var userId = alert.user_id;
		var alertSystem = alert.alert_system;

		if (_.has(map, userId)) {
			var systemMap = map[userId];

			if (_.has(systemMap, alertSystem)) {
				returnRef = systemMap[alertSystem];
			}
		}

		return returnRef;
	}

	AlertManager.getPropertiesForTarget = function(properties, target) {
		return _.filter(properties, function(property) {
			return property.target.target_id === target.target_id;
		});
	};

	AlertManager.getOperatorsForProperty = function(operators, property) {
		var operatorMap = AlertManager.getOperatorMap(operators);

		return _.map(property.valid_operators, function(operatorId) {
			return operatorMap[operatorId];
		});
	};

	AlertManager.getPropertyTree = function(properties) {
		var returnRef = _.reduce(properties, function(tree, property) {
			var descriptionPath = [ property.group ].concat(property.category || [ ]).concat(property.description || [ ]);

			var node = tree;

			for (var i = 0; i < descriptionPath.length; i++) {
				node.items = node.items || [ ];

				var description = descriptionPath[i];

				var child = _.find(node.items, function(candidate) {
					return candidate.description === description;
				});

				if (!child) {
					child = {
						description: description
					};

					node.items.push(child);
				}

				node = child;
			}

			node.item = property;

			return tree;
		}, { });

		return returnRef.items;
	};

	AlertManager.getPropertyMap = function(properties) {
		return _.indexBy(properties, function(property) {
			return property.property_id;
		});
	};

	AlertManager.getOperatorMap = function(operators) {
		return _.indexBy(operators, function(operator) {
			return operator.operator_id;
		});
	};

	return AlertManager;
})();