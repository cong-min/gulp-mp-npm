/* 修改文件内容中引用 npm 依赖模块的路径 */
const path = require('path');
const importRegex = require('import-regex');
const matchRequire = require('match-require');
const trim = require('lodash/trim');
const getPackageName = require('./utils/getPackageName');
const replaceNodeModulesPath = require('./utils/replaceNodeModulesPath');

const defaultNpmDirname = 'miniprogram_npm'; // 小程序官方方案默认输出路径


module.exports = (file, pkgList, npmDirname = defaultNpmDirname) => {
    const { extname, contents } = file;
    const isCss = ['.css', '.wxss', '.less', '.sass'].includes(extname);
    const isJs = ['.js', '.wxs', '.jsx', '.ts'].includes(extname);

    // 如果不是 css / js 则不处理
    if (!isCss && !isJs) return file;

    let fileContent = String(contents); // 获取文件内容

    // 替换规则
    function replaceRule(moduleId) {
        const pkgName = getPackageName(moduleId);
        if (pkgName && pkgList[pkgName]) {
            const pkg = pkgList[pkgName];
            const pkgBase = pkg.path.replace(/\\/g, '/').split('/node_modules/')[0];
            // 同一 base 下的相对路径
            let relativePath = path.relative(
                replaceNodeModulesPath(file.dirname.replace(file.base, pkgBase), npmDirname),
                replaceNodeModulesPath(pkg.path, npmDirname)
            );
            const pkgReg = new RegExp(`^${pkgName}`);
            // 如果引入的入口文件，则加上包的 index 路径进行替换
            if (moduleId === pkgName) {
                relativePath = path.join(relativePath, `index${path.extname(pkg.main) || '.js'}`);
            }
            // 如果 relativePath 前没有 . 则需追加上 ./
            if (relativePath[0] !== '.') {
                relativePath = `./${relativePath}`;
            }
            return moduleId.replace(pkgReg, relativePath);
        } else {
            return moduleId;
        }
    }

    // 对于样式引用了 npm 依赖, 小程序解析路径, 需对内容路径进行替换
    if (isCss) {
        // 找出 css 中的 @import
        const matchList = fileContent.match(importRegex()) || [];
        // 循环替换
        matchList.forEach((oldString = '') => {
            // 匹配单个 css import 匹配 moduleId
            const m = oldString.match(/@import\s+(?:url\()?(.+(?=['")]))(?:\))?.*/i) || [];
            const oldModuleId = m[1] ? trim(m[1], '\'"') : ''; // 找到 moduleId
            const newModuleId = replaceRule(oldModuleId); // 替换新的 moduleId
            const newString = oldString.replace(oldModuleId, newModuleId);
            fileContent = fileContent.replace(oldString, newString);
        });
    }

    // 对于非默认官方方案输出, 也需替换原文件中的 moduleId
    if (npmDirname !== defaultNpmDirname) {
        // 替换 js import / require 的引入
        fileContent = matchRequire.replaceAll(fileContent, replaceRule);
    }

    file.contents = Buffer.from(fileContent);

    return file;
};
