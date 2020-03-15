/* 处理小程序专用 npm 包 */
const path = require('path');
const resolveFrom = require('resolve-from');
const loadJsonFile = require('load-json-file');
const getPackageName = require('./utils/getPackageName');

const defaultNpmDist = 'miniprogram_dist'; // 默认小程序专用包的构建目录

const cache = {
    pkg: {}, // pkgJson 缓存
};

// 获取小程序专用 npm 包构建目录路径
async function getBuildPath(pkgJsonPath) {
    // 读取 pkgJson 的配置字段 miniprogram
    let pkgJson = cache.pkg[pkgJsonPath];
    if (!pkgJson) {
        try { pkgJson = await loadJsonFile(pkgJsonPath) || {}; } catch (e) { } // 加载组件 json
        cache.pkg[pkgJsonPath] = pkgJson;
    }
    const dist = pkgJson.miniprogram || defaultNpmDist;
    return path.join(path.dirname(pkgJsonPath), dist);
}

// 解析小程序专用 npm 包的路径
async function resolvePathFrom(filepath, expression) {
    // 尝试通过表达式获取包名
    const expressionPkgName = getPackageName(expression);
    // 如果不能直接获取包名, 则尝试获取引用文件的包名
    const packageName = expressionPkgName || getPackageName(filepath);
    if (!packageName) return {}; // 非 npm 包

    // 找到 npm 包路径
    const pkgRelativePath = path.join(packageName, 'package.json');
    const pkgJsonPath = resolveFrom.silent(path.dirname(filepath), pkgRelativePath);
    if (!pkgJsonPath) return { packageName };

    // 找到小程序专用 npm 包构建路径
    const buildPath = await getBuildPath(pkgJsonPath);

    // 解析出组件所在文件夹的路径
    const pkgReg = new RegExp(`^${packageName}(/|$)`);
    const resolvedPath = path.join(expressionPkgName ? buildPath : path.dirname(filepath),
        expression.replace(pkgReg, ''));

    return {
        packageName,
        buildPath,
        resolvedPath,
    };
}

module.exports = {
    cache,
    getBuildPath,
    resolvePathFrom
};
