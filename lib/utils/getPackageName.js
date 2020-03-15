// 通过路径或表达式解析模块名
const path = require('path');
const getNodeModulesPath = require('./getNodeModulesPath');

module.exports = (filepath = '') => {
    filepath = filepath.replace(/\\/g, '/');

    const nodeModulesPath = getNodeModulesPath(filepath);
    // 如果为路径, 则找到在 node_modules 下的相对路径
    if (nodeModulesPath) filepath = path.relative(nodeModulesPath, filepath);

    let packageName = '';
    if (filepath[0] !== '/') {
        const parts = filepath.split('/');
        if (parts.length > 0 && parts[0][0] === '@') {
            packageName += `${parts.shift()}/`;
        }
        packageName += parts.shift();
    }

    return packageName;
};
