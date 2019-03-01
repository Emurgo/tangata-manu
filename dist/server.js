"use strict";

require("core-js/modules/es6.object.define-property");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("core-js/modules/es6.promise");

require("regenerator-runtime/runtime");

require("core-js/modules/es6.function.name");

var _restify = _interopRequireDefault(require("restify"));

var _config = _interopRequireDefault(require("config"));

var _logger = _interopRequireDefault(require("./logger"));

var _db = _interopRequireDefault(require("./db"));

var _cron = require("./cron");

var _cardanoBridgeApi = _interopRequireDefault(require("./cardano-bridge-api"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var serverConfig = _config.default.get('server');

var cardanoBridgeConfig = _config.default.get('cardanoBridge');

var logger = (0, _logger.default)(_config.default.get('appName'), serverConfig.logLevel);
var api = new _cardanoBridgeApi.default(cardanoBridgeConfig.baseUrl, cardanoBridgeConfig.template);

var hello = function hello(req, res, next) {
  res.send("hello ".concat(req.params.name));
  next();
};

var server = _restify.default.createServer();

server.get('/hello/:name', hello);

var startServer =
/*#__PURE__*/
function () {
  var _ref = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee() {
    var db, checkBlockchainTipJob;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return (0, _db.default)(_config.default.get('db'));

          case 2:
            db = _context.sent;
            checkBlockchainTipJob = new _cron.CheckBlockchainTipJob({
              cronTime: '*/3 * * * * *',
              context: {
                db: db,
                logger: logger,
                api: api
              }
            });
            checkBlockchainTipJob.start();
            server.listen(serverConfig.port, function () {
              logger.info('%s listening at %s', server.name, server.url);
            });

          case 6:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));

  return function startServer() {
    return _ref.apply(this, arguments);
  };
}();

var _default = startServer;
exports.default = _default;