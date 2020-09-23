"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mitt = exports.promisify = exports.promisifyAll = void 0;
var miniprogram_api_promise_1 = require("../dist/miniprogram-api-promise/src/index.js");
Object.defineProperty(exports, "promisifyAll", { enumerable: true, get: function () { return miniprogram_api_promise_1.promisifyAll; } });
Object.defineProperty(exports, "promisify", { enumerable: true, get: function () { return miniprogram_api_promise_1.promisify; } });
var mitt_1 = require("../dist/mitt/dist/mitt.js");
exports.mitt = mitt_1.default;

//# sourceMappingURL=index.js.map
