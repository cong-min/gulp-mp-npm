const path = require('path');
const fs = require('fs');
const precinct = require('precinct');
const resolveFrom = require('resolve-from');
const getPackageName = require('./utils/getPackageName');

const natives = process.binding('natives');

// 自定义的类型映射
const typeMap = {
    wxss: 'css',
    wxs: 'js',
};

// parseDeps 分析文件获取所有依赖模块 返回引入路径表达式列表
function parseDeps(filepath, fileContent, precinctOptions) {
    let moduleIdList;
    const type = path.extname(filepath).replace('.', '');

    // 依赖分析
    try {
        fileContent = fileContent || fs.readFileSync(filepath, 'utf8');
        moduleIdList = precinct(fileContent, {
            type: typeMap[type], // 指定自定义文件类型
            es6: { mixedImports: true },
            ...precinctOptions,
        }).filter((d) => !natives[d]);
    } catch (e) { }

    return moduleIdList || [];
}

// resolveDep 解析文件所依赖的 npm 模块名称 返回引入路径表达式与依赖包名及路径的映射
async function resolveDep(moduleId, filepath, options) {
    const { alias = [] } = options || {};

    // alias module id
    let packageName = getPackageName(moduleId);
    if (packageName) {
        const pkgReg = new RegExp(`^${packageName}`);
        moduleId = moduleId.replace(pkgReg, alias[packageName] || packageName);
    }

    const depPath = resolveFrom.silent(path.dirname(filepath), moduleId);

    // 解析出的文件不是 npm 依赖包
    if (!depPath || !/\/node_modules\//.test(depPath)) return {};

    // 获取正确的 packageName
    packageName = getPackageName(depPath);

    return {
        packageName,
        depPath,
    };
}

// lookupDependencies 递归分析依赖树
async function lookupDependencies(filepath, fileContent, options) {
    const deps = {};
    if (!filepath) return deps;

    // 分析并解析依赖映射
    const moduleIdList = parseDeps(filepath, fileContent);

    await Promise.all(moduleIdList.map(async moduleId => {
        // 解析
        const {
            packageName,
            depPath
        } = await resolveDep(moduleId, filepath, options);
        if (!depPath) return;

        // 递归依赖映射
        const subTree = await lookupDependencies(depPath, null, options);

        deps[depPath] = {
            moduleId,
            name: packageName,
            tree: subTree,
        };
    }));

    return deps;
}

module.exports = lookupDependencies;
