// app.ts
import { mitt } from './utils/index';

App({
    /* 生命周期 */
    // 小程序初始化完成时触发，全局只触发一次
    onLaunch(options) {
        console.log('onLaunch options', options);
    },
    // 小程序启动，或从后台进入前台显示时触发
    onShow() { },
    // 小程序从前台进入后台时触发
    onHide() { },
    // 小程序发生脚本错误或 API 调用报错时触发
    onError() { },
    // 小程序要打开的页面不存在时触发
    onPageNotFound() { },

    /* Global Data */
    globalData: { },

    emitter: mitt(),

    /* Global Methods */

});
