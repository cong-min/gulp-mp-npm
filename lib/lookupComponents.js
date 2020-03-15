// 根据 page json 内容寻找声明的小程序组件构建路径
const path = require('path');
const loadJsonFile = require('load-json-file');
const resolveFrom = require('resolve-from');
const getPackageName = require('./utils/getPackageName');

const defaultComponentDist = 'miniprogram_dist';

const cache = {};

module.exports = async (jsonContent, jsonPath) => {
    const components = {};
    // 缓存
    if (cache[jsonPath]) return cache[jsonPath];

    // 尝试分析 usingComponents 字段
    let compExpressions = [];
    try {
        const { usingComponents = {} } = JSON.parse(jsonContent) || {};
        compExpressions = Object.values(usingComponents);
    } catch (e) { }

    await Promise.all(compExpressions.map(async expression => {
        const packageName = getPackageName(expression);
        // TODO 支持递归分析组件依赖的组件
        if (!packageName) return;
        // 找到 pkgJson 路径
        const pkgRelativePath = path.join(packageName, 'package.json');
        const pkgJsonPath = resolveFrom.silent(path.dirname(jsonPath), pkgRelativePath);
        if (!pkgJsonPath) return;

        // 加载 pkgJson
        let pkgJson = {};
        try { pkgJson = await loadJsonFile(pkgJsonPath) || {}; } catch (e) { }
        // 解析 miniprogram 字段, 找到构建路径
        const dist = pkgJson.miniprogram || defaultComponentDist;
        const buildPath = path.join(path.dirname(pkgJsonPath), dist);
        // 解析出组件所在文件夹的路径
        let componentPath = path.join(buildPath, `${expression.replace(packageName, '')}.js`);
        componentPath = path.dirname(componentPath);
        components[expression] = {
            name: packageName,
            buildPath,
            componentPath,
        };
    }));

    cache[jsonPath] = components;

    return components;
};
