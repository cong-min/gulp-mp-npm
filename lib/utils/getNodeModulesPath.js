// 通过路径解析所在的 node_modules 文件夹路径
const path = require('path');

module.exports = (filepath = '') => {
    const separator = '/node_modules/';
    const pathSplit = filepath.replace(/\\/g, '/').split(separator);
    if (pathSplit.length === 1) return '';
    pathSplit.pop();
    return path.join(pathSplit.join(separator), separator);
};
