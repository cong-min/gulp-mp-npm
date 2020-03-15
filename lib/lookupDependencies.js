/** depTree
 * 分析文件的依赖树
 * Inspired by https://github.com/dependents/node-dependency-tree/blob/master/index.js
 */
const path = require('path');
const fs = require('fs');
const precinct = require('precinct');
const resolveFrom = require('resolve-from');
const miniprogramNpm = require('./miniprogramNpm');
const getPackageName = require('./utils/getPackageName');
const getNodeModulesPath = require('./utils/getNodeModulesPath');

const natives = process.binding('natives');

// 自定义的类型映射
const typeMap = {
    wxss: 'css',
    wxs: 'js',
};

const cache = {
    tree: {}, // 依赖树缓存
};

// getDeps 分析文件获取所有依赖模块 返回引入路径表达式列表
function getDeps(filepath, precinctOptions) {
    let depExpressions;
    const type = path.extname(filepath).replace('.', '');

    // 依赖分析
    try {
        const fileContent = fs.readFileSync(filepath, 'utf8');

        depExpressions = precinct(fileContent, {
            type: typeMap[type], // 指定自定义文件类型
            ...precinctOptions,
        }).filter((d) => !natives[d]);
    } catch (e) { }

    return depExpressions || [];
}

// resloveNpmDeps 解析文件所依赖的 npm 模块名称 返回引入路径表达式与依赖包名及路径的映射
async function resloveNpmDeps(depExpressions, filepath) {
    const deps = {};
    await Promise.all(depExpressions.map(async depExp => {
        // 尝试解析
        let depPath = resolveFrom.silent(path.dirname(filepath), depExp);
        let packageName = getPackageName(depPath || depExp);
        let packagePath = depPath ? path.join(getNodeModulesPath(depPath), packageName) : null;

        // 若未解析出, 尝试以小程序 npm 包形式解析 (会先读取 buildPath 再解析)
        if (!depPath) {
            const resolved = await miniprogramNpm.resolvePathFrom(filepath, depExp);
            packageName = resolved.packageName;
            depPath = resolved.resolvedPath;
            packagePath = resolved.buildPath; // 将 buildPath 作为 packagePath
        }

        // 解析出的文件不是 npm 依赖包
        if (!depPath || !/\/node_modules\//.test(depPath)) return;

        deps[depExp] = {
            name: packageName,
            path: depPath,
            packagePath,
        };
    }));

    return deps;
}

// lookupDependencies 递归分析依赖树
async function lookupDependencies(filepath) {
    const subTree = {};
    // 文件不存在
    if (!filepath || !fs.existsSync(filepath)) return subTree;
    // 缓存
    if (cache.tree[filepath]) return cache.tree[filepath];

    // 分析并解析依赖映射
    const depExpressions = getDeps(filepath);
    const deps = await resloveNpmDeps(depExpressions, filepath);

    // 循环依赖映射
    await Promise.all(Object.keys(deps).map(async expression => {
        const { name, path: depPath, packagePath } = deps[expression];
        if (!depPath) return;
        subTree[depPath] = {
            name, // 依赖包名
            expression, // 依赖表达式
            packagePath,
            tree: await lookupDependencies(depPath), // 子依赖树
        };
    }));

    cache.tree[filepath] = subTree;

    return subTree;
}

// 将 depTree 转换为单层 depMap
function treeToMap(tree) {
    const map = {};
    Object.keys(tree).forEach(depPath => {
        const {
            name, expression, packagePath, tree: subTree
        } = tree[depPath];
        map[depPath] = {
            name,
            expression,
            packagePath,
        };
        Object.assign(map, treeToMap(subTree || {}));
    });
    return map;
}

module.exports = lookupDependencies;
module.exports.get = getDeps;
module.exports.reslove = resloveNpmDeps;
module.exports.treeToMap = treeToMap;
