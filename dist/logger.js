"use strict";

require("core-js/modules/es6.object.define-property");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _bunyan = _interopRequireDefault(require("bunyan"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var consoleLogger = function consoleLogger(appName) {
  var level = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'debug';
  return new _bunyan.default.createLogger({
    name: appName,
    level: level
  });
};

var _default = consoleLogger;
exports.default = _default;