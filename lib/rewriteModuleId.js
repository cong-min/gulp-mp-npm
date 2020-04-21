/* 修改文件内容中引用 npm 依赖模块的路径 */
const path = require('path');
const importRegex = require('import-regex');
const resolveFrom = require('resolve-from');
const trim = require('lodash/trim');
const getPackageName = require('./utils/getPackageName');
const replaceNodeModulesPath = require('./utils/replaceNodeModulesPath');

const CSS_IMPORT_RE = /@import\s+(?:url\()?(.+(?=['")]))(?:\))?.*/i;
const IMPORT_RE = /(\bimport\s+(?:[^'"]+\s+from\s+)??)(['"])([^'"]+)(\2)/g;
const EXPORT_RE = /(\bexport\s+(?:[^'"]+\s+from\s+)??)(['"])([^'"]+)(\2)/g;
const REQUIRE_RE = /(\brequire\s*?\(\s*?)(['"])([^'"]+)(\2\s*?\))/g;

const defaultNpmDirname = 'miniprogram_npm'; // 小程序官方方案默认输出路径

module.exports = (file, pkgList, npmDirname = defaultNpmDirname) => {
    const { extname, contents } = file;
    const isCss = ['.css', '.wxss', '.less', '.sass'].includes(extname);
    const isJs = ['.js', '.wxs', '.jsx', '.ts'].includes(extname);
    const isJson = ['.json'].includes(extname);

    // 如果是导出文件夹为官方小程序 miniprogram_npm 方案 并且 当引入依赖的是模块主入口时
    // 则需修改入口文件为 index 路径
    if (npmDirname === defaultNpmDirname && file.isPackageMain) {
        const mainPathReg = new RegExp(`${file.isPackageMain}$`);
        file.path = file.path.replace(mainPathReg, `index${file.extname || '.js'}`);
    }

    // 如果不是 css / js / json 则不处理
    if (!isCss && !isJs && !isJson) return file;

    let fileContent = String(contents); // 获取文件内容

    // 如果 relativePath 不是相对路径则需追加上 ./
    const startsWith = (str, prefix) => str.slice(0, prefix.length) === prefix;
    // 替换规则
    function replaceRule(moduleId) {
        const pkgName = getPackageName(moduleId);
        if (pkgName && pkgList[pkgName]) {
            const pkg = pkgList[pkgName];
            let pkgPath = pkg.path;
            const pkgBase = pkgPath.replace(/\\/g, '/').split('/node_modules/')[0];
            // 如果引入的入口文件，则修改路径为包入口文件
            if (moduleId === pkgName) {
                if (npmDirname === defaultNpmDirname) { // 默认官方方案，入口追加 index
                    pkgPath = path.join(pkgPath, `index${path.extname(pkg.main) || '.js'}`);
                } else if (pkg.isMiniprogramPkg) { // 自定义提取方案，小程序专用包入口替换 buildPath
                    const buildPathReg = new RegExp(`^${pkg.buildPath}`);
                    pkgPath = pkg.main.replace(buildPathReg, pkg.path);
                } else { // 其他追加 main 路径
                    pkgPath = pkg.main;
                }
            }
            // 同一 base 下的相对路径
            let relativePath = path.relative(
                replaceNodeModulesPath(file.dirname.replace(file.base, pkgBase), npmDirname),
                replaceNodeModulesPath(pkgPath, npmDirname)
            );
            const pkgReg = new RegExp(`^${pkgName}`);
            if (!startsWith(relativePath, './') && !startsWith(relativePath, '../')) {
                relativePath = `./${relativePath}`;
            }
            return moduleId.replace(pkgReg, relativePath);
        } else if (npmDirname === defaultNpmDirname && file.isPackageMain) {
            let relativePath = path.join(path.dirname(file.isPackageMain), moduleId);
            if (!startsWith(relativePath, './') && !startsWith(relativePath, '../')) {
                relativePath = `./${relativePath}`;
            }
            return relativePath;
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
            const m = oldString.match(CSS_IMPORT_RE) || [];
            const oldModuleId = m[1] ? trim(m[1], '\'"') : ''; // 找到 moduleId
            const newModuleId = replaceRule(oldModuleId); // 替换新的 moduleId
            const newString = oldString.replace(oldModuleId, newModuleId);
            fileContent = fileContent.replace(oldString, newString);
        });
    }

    // 对于非默认官方方案输出 或 重写路径的包主入口, 也需替换原文件中的 moduleId
    if (npmDirname !== defaultNpmDirname || file.isPackageMain) {
        if (isJs) {
            // 替换 js import / require 的引入
            const replacement = (_match, pre, quot, dep, post) =>
                `${pre}${quot}${replaceRule(dep)}${post}`;
            fileContent = fileContent
                .replace(IMPORT_RE, replacement)
                .replace(EXPORT_RE, replacement)
                .replace(REQUIRE_RE, replacement);
        }

        // 如果是 json 文件则尝试替换 usingComponents 字段
        if (isJson) {
            let json = {};
            try { json = JSON.parse(fileContent) || {}; } catch (e) { }
            const { usingComponents } = json;
            if (usingComponents) {
                Object.keys(usingComponents).forEach(key => {
                    const moduleId = usingComponents[key];
                    if (typeof moduleId === 'string') {
                        usingComponents[key] = replaceRule(moduleId);
                    }
                });
                json.usingComponents = usingComponents;
                fileContent = JSON.stringify(json, null, 2);
            }
        }
    }

    file.contents = Buffer.from(fileContent);

    return file;
};
