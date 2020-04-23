// index.ts
//const app = getApp();

Page({
    // 页面响应数据
    data: {
        start: false,
    },

    /* 生命周期 */
    // 页面加载
    onLoad(query) {
        console.log('onLoad query', query);
    },
    // 页面切入显示
    onShow() { },
    // 页面渲染完成
    onReady() { },
    // 页面隐藏
    onHide() { },
    // 页面卸载
    onUnload() { },

    /* 页面事件 */
    // 下拉刷新
    //onPullDownRefresh() {},
    // 上拉触底
    //onReachBottom() {},
    // 页面滚动
    //onPageScroll(event) {},
    // 页面尺寸改变
    //onResize() {},
    // 转发分享 (定义了此事件，右上角菜单将显示`转发`按钮)
    //onShareAppMessage(event) {},
    // 当前是 Tab 页时，点击 Tab 项
    //onTabItemTap(item) {},

    /* Others */

    /* Methods */
    quickstart() {
        this.setData({
            start: true,
        });
    }

});
