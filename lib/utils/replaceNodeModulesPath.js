// 替换所有 node_modules 为 npmDirname
module.exports = (filepath = '', npmDirname) =>
    filepath.replace(/\\/g, '/').replace(/\/node_modules\//g, `/${npmDirname}/`);
