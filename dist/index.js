"use strict";

var _server = _interopRequireDefault(require("./server"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Don't check client certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
(0, _server.default)();