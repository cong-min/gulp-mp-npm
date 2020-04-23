"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("./utils/index");
App({
    onLaunch: function (options) {
        console.log('onLaunch options', options);
    },
    onShow: function () { },
    onHide: function () { },
    onError: function () { },
    onPageNotFound: function () { },
    globalData: {},
    emitter: index_1.mitt(),
});

//# sourceMappingURL=app.js.map
