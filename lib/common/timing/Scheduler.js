var assert = require('./../lang/assert');
var Disposable = require('./../lang/Disposable');

module.exports = (() => {
	'use strict';

	class Scheduler extends Disposable {
		constructor() {
			super();

			this._timeoutBindings = {};
		}

		schedule(actionToSchedule, millisecondDelay, actionDescription) {
			assert.argumentIsRequired(actionToSchedule, 'actionToSchedule', Function);
			assert.argumentIsRequired(millisecondDelay, 'millisecondDelay', Number);
			assert.argumentIsOptional(actionDescription, 'actionDescription', String);

			if (this.getIsDisposed()) {
				throw new Error('The Scheduler has been disposed.');
			}

			let token;

			const schedulePromise = new Promise((resolveCallback, rejectCallback) => {
				const wrappedAction = () => {
					delete this._timeoutBindings[token];

					try {
						resolveCallback(actionToSchedule());
					} catch (e) {
						rejectCallback(e);
					}
				};

				token = setTimeout(wrappedAction, millisecondDelay);
			});

			this._timeoutBindings[token] = Disposable.fromAction(() => {
				clearTimeout(token);

				delete this._timeoutBindings[token];
			});

			return schedulePromise;
		}

		backoff(actionToBackoff, millisecondDelay, actionDescription, maximumAttempts) {
			assert.argumentIsRequired(actionToBackoff, 'actionToBackoff', Function);
			assert.argumentIsOptional(millisecondDelay, 'millisecondDelay', Number);
			assert.argumentIsOptional(actionDescription, 'actionDescription', String);
			assert.argumentIsOptional(maximumAttempts, 'maximumAttempts', Number);

			if (this.getIsDisposed()) {
				throw new Error('The Scheduler has been disposed.');
			}

			const scheduleBackoff = (failureCount) => {
				if (maximumAttempts > 0 && failureCount > maximumAttempts) {
					return Promise.reject(`Maximum failures reaacked for ${actionDescription}`);
				}

				let backoffDelay;

				if (failureCount === 0) {
					backoffDelay = millisecondDelay;
				} else {
					backoffDelay = (millisecondDelay || 1000) * Math.pow(2, failureCount);
				}

				return this.schedule(actionToBackoff, backoffDelay, (actionDescription || 'unspecified') + ', attempt ' + (failureCount + 1))
					.then(function(result) {
						if (result) {
							return result;
						} else {
							return scheduleBackoff(++failureCount);
						}
					}).catch(function(e) {
						return scheduleBackoff(++failureCount);
					});
			};

			return scheduleBackoff(0);
		}

		_onDispose() {
			Object.keys(this._timeoutBindings).forEach((key) => {
				this._timeoutBindings[key].dispose();
			});

			this._timeoutBindings = null;
		}

		toString() {
			return '[Scheduler]';
		}
	}

	return Scheduler;
})();