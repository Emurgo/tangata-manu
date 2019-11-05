
const path = require('path').join(__dirname, 'js_chain_libs_bg.wasm');
const bytes = require('fs').readFileSync(path);
let imports = {};
imports['./js_chain_libs.js'] = require('./js_chain_libs.js');

const wasmModule = new WebAssembly.Module(bytes);
const wasmInstance = new WebAssembly.Instance(wasmModule, imports);
module.exports = wasmInstance.exports;
