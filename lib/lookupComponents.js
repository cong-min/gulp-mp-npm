// 根据 page json 内容寻找声明的小程序组件构建路径
const path = require('path');
const loadJsonFile = require('load-json-file');
const resolveFrom = require('resolve-from');
const getPackageName = require('./utils/getPackageName');
const getNodeModulesPath = require('./utils/getNodeModulesPath');

// 默认小程序组件专用包的构建目录
const defaultComponentDist = 'miniprogram_dist';

const cache = {
    tree: {}, // 依赖树缓存
    pkg: {}, // pkgJson 缓存
};

// 递归遍历分析组件依赖树
async function lookupComponents(jsonContent, jsonPath) {
    const components = {};
    // 缓存
    if (cache.tree[jsonPath]) return cache.tree[jsonPath];

    // 尝试分析 usingComponents 字段
    let compExpressions = [];
    try {
        jsonContent = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
        const { usingComponents = {} } = jsonContent || {};
        compExpressions = Object.values(usingComponents);
    } catch (e) { }

    await Promise.all(compExpressions.map(async expression => {
        // 尝试通过表达式获取包名
        const expressionPkgName = getPackageName(expression);
        // 如果不能直接获取包名, 则尝试获取 jsonPath 的包名
        const packageName = expressionPkgName || getPackageName(jsonPath);
        if (!packageName) return; // 非 npm 包

        // 找到组件 npm 包路径
        const pkgRelativePath = path.join(packageName, 'package.json');
        const pkgJsonPath = resolveFrom.silent(path.dirname(jsonPath), pkgRelativePath);
        if (!pkgJsonPath) return;

        // 读取 pkgJson 的配置字段 miniprogram
        let pkgJson = cache.pkg[pkgJsonPath];
        if (!pkgJson) {
            try { pkgJson = await loadJsonFile(pkgJsonPath) || {}; } catch (e) { } // 加载组件 json
            cache.pkg[pkgJsonPath] = pkgJson;
        }
        const dist = pkgJson.miniprogram || defaultComponentDist;
        const buildPath = path.join(path.dirname(pkgJsonPath), dist);

        // 解析出组件所在文件夹的路径
        const compJsonPath = path.join(expressionPkgName ? buildPath : path.dirname(jsonPath),
            `${expression.replace(new RegExp(`^${packageName}(/|$)`), '')}.json`);
        const componentPath = path.dirname(compJsonPath);

        // 向下递归分析组件依赖的组件
        let compJson = {};
        try { compJson = await loadJsonFile(compJsonPath) || {}; } catch (e) { } // 加载组件 json
        const depComponents = await lookupComponents(compJson, compJsonPath);

        components[componentPath] = {
            name: packageName,
            expression,
            buildPath,
            tree: depComponents,
        };
    }));

    cache.tree[jsonPath] = components;

    return components;
}

// 将 compTree 转换为单层 compMap
function treeToMap(tree) {
    const map = {};
    Object.keys(tree).forEach(compPath => {
        const {
            name, expression, buildPath, tree: subTree = {}
        } = tree[compPath];
        map[compPath] = {
            name,
            expression,
            buildPath,
        };
        Object.assign(map, treeToMap(subTree));
    });
    return map;
}


module.exports = lookupComponents;
module.exports.treeToMap = treeToMap;
