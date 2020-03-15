// 根据 page json 内容寻找声明的小程序组件构建路径
const path = require('path');
const loadJsonFile = require('load-json-file');
const miniprogramNpm = require('./miniprogramNpm');

const cache = {
    tree: {}, // 依赖树缓存
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
        // 解析小程序专用包路径
        const {
            packageName,
            buildPath,
            resolvedPath,
        } = await miniprogramNpm.resolvePathFrom(jsonPath, expression);
        if (!packageName || !buildPath || !resolvedPath) return;

        // 组件路径
        const compJsonPath = `${resolvedPath}.json`;
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
