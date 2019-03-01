"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.CheckBlockchainTipJob = exports.YoroiBaseJob = void 0;

require("core-js/modules/es7.symbol.async-iterator");

require("core-js/modules/es6.symbol");

require("core-js/modules/es6.promise");

require("core-js/modules/es6.object.create");

require("core-js/modules/es6.object.set-prototype-of");

require("core-js/modules/es6.array.for-each");

require("core-js/modules/es6.array.filter");

require("core-js/modules/web.dom.iterable");

require("core-js/modules/es6.array.iterator");

require("core-js/modules/es6.object.keys");

require("core-js/modules/es6.object.define-property");

require("regenerator-runtime/runtime");

var _crypto = _interopRequireDefault(require("crypto"));

var _cron = _interopRequireDefault(require("cron"));

var _dbQueries = _interopRequireDefault(require("./db-queries"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

/* eslint class-methods-use-this: ["error", { "exceptMethods": ["onTick"] }] */
var YoroiBaseJob =
/*#__PURE__*/
function () {
  function YoroiBaseJob(config) {
    var _this = this;

    _classCallCheck(this, YoroiBaseJob);

    this.context = _objectSpread({}, config.context);
    this.job = new _cron.default.CronJob(_objectSpread({}, config, {
      onTick: function onTick() {
        return _this.onTick();
      }
    }));
  }

  _createClass(YoroiBaseJob, [{
    key: "onTick",
    value: function onTick() {
      throw new Error('You have to implement the method onTick!');
    }
  }, {
    key: "start",
    value: function start() {
      this.job.start();
    }
  }]);

  return YoroiBaseJob;
}();

exports.YoroiBaseJob = YoroiBaseJob;

var CheckBlockchainTipJob =
/*#__PURE__*/
function (_YoroiBaseJob) {
  _inherits(CheckBlockchainTipJob, _YoroiBaseJob);

  function CheckBlockchainTipJob() {
    _classCallCheck(this, CheckBlockchainTipJob);

    return _possibleConstructorReturn(this, _getPrototypeOf(CheckBlockchainTipJob).apply(this, arguments));
  }

  _createClass(CheckBlockchainTipJob, [{
    key: "onTick",
    value: function () {
      var _onTick = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee() {
        var _this$context, db, logger, api, tip, blockHash, hexHash, dbRes;

        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                /*  Check blockchain tip block and store it to database if it is not yet stored.
                */
                _this$context = this.context, db = _this$context.db, logger = _this$context.logger, api = _this$context.api;
                _context.next = 3;
                return api.getTip();

              case 3:
                tip = _context.sent;
                blockHash = _crypto.default.createHash('md5');
                hexHash = blockHash.update(tip.data).digest('hex');
                _context.next = 8;
                return db.query(_dbQueries.default.upsertBlockHash, [hexHash]);

              case 8:
                dbRes = _context.sent;
                logger.info(dbRes.rowCount > 0 ? 'New block added' : 'DB is up-to-date');

              case 10:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function onTick() {
        return _onTick.apply(this, arguments);
      }

      return onTick;
    }()
  }]);

  return CheckBlockchainTipJob;
}(YoroiBaseJob);

exports.CheckBlockchainTipJob = CheckBlockchainTipJob;
var jobs = [CheckBlockchainTipJob];
var _default = jobs;
exports.default = _default;