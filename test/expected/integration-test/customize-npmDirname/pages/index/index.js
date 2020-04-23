"use strict";
Page({
    data: {
        start: false,
    },
    onLoad: function (query) {
        console.log('onLoad query', query);
    },
    onShow: function () { },
    onReady: function () { },
    onHide: function () { },
    onUnload: function () { },
    quickstart: function () {
        this.setData({
            start: true,
        });
    }
});

//# sourceMappingURL=index.js.map
