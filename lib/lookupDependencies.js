/** depTree
 * 分析文件的依赖树
 * Inspired by https://github.com/dependents/node-dependency-tree/blob/master/index.js
 */
const path = require('path');
const fs = require('fs');
const precinct = require('precinct');
const resolveFrom = require('resolve-from');
const getPackageName = require('./utils/getPackageName');

const cache = {};

// getDeps 分析文件获取所有依赖模块 返回引入路径表达式列表
function getDeps(filepath, precinctOptions) {
    let depExpressions;

    // 依赖分析
    try {
        depExpressions = precinct.paperwork(filepath, {
            includeCore: false, // 不包含 node 自建模块
            ...precinctOptions,
        });
    } catch (e) { }

    return depExpressions || [];
}

// resloveNpmDeps 解析文件所依赖的 npm 模块名称 返回引入路径表达式与依赖包名及路径的映射
function resloveNpmDeps(depExpressions, filepath, cabinetOptions) {
    const deps = {};

    depExpressions.forEach(depExp => {
        let depPath = resolveFrom.silent(path.dirname(filepath), depExp);

        if (!depPath // 无法解析
            || !fs.existsSync(depPath) // 解析文件为空
            || !/\/node_modules\//.test(depPath) // 解析出的文件不是 npm 依赖包
        ) {
            depPath = null;
        }

        deps[depExp] = {
            name: getPackageName(depPath || depExp),
            path: depPath,
        };
    });

    return deps;
}

// depTree 递归遍历分析依赖
function depTree(filepath) {
    const subTree = {};
    // 文件不存在
    if (!filepath || !fs.existsSync(filepath)) return subTree;
    // 缓存
    if (cache[filepath]) return cache[filepath];

    // 分析并解析依赖映射
    const depExpressions = getDeps(filepath);
    const deps = resloveNpmDeps(depExpressions, filepath);

    // 循环依赖映射
    Object.keys(deps).forEach(expression => {
        const { name, path: depPath } = deps[expression];
        if (!depPath) return;
        subTree[depPath] = {
            name, // 依赖包名
            expression, // 依赖表达式
            tree: depTree(depPath), // 子依赖树
        };
    });

    cache[filepath] = subTree;

    return subTree;
}

// 将 depTree 转换为单层 depMap
function treeToMap(tree) {
    const map = {};
    Object.keys(tree).forEach(depPath => {
        const { name, expression, tree: subTree } = tree[depPath];
        map[depPath] = {
            name,
            expression,
        };
        Object.assign(map, treeToMap(subTree || {}));
    });
    return map;
}

module.exports = depTree;
module.exports.get = getDeps;
module.exports.reslove = resloveNpmDeps;
module.exports.treeToMap = treeToMap;
