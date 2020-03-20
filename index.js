const path = require('path');
const lead = require('lead');
const pumpify = require('pumpify');
const through = require('through2');
const vfs = require('vinyl-fs');
const logger = require('fancy-log');
const treeToList = require('tree-to-list');
const checkPackage = require('./lib/checkPackage');
const lookupComponents = require('./lib/lookupComponents');
const lookupDependencies = require('./lib/lookupDependencies');
const rewriteModuleId = require('./lib/rewriteModuleId');
const replaceNodeModulesPath = require('./lib/utils/replaceNodeModulesPath');

const defaultNpmDirname = 'miniprogram_npm'; // 小程序官方方案默认输出路径

// 所有依赖包列表
let pkgList = {};
// 小程序专用 npm 依赖包名与构建路径的映射, 将作为 resolve 时的 alias
const mpPkgMathMap = {};
// 是否已初始化
let inited = false;

/**
 * gulp-mp-npm
 */
module.exports = function mpNpm(options = {}) {
    const npmDirname = options.npmDirname || defaultNpmDirname;

    /** init
     * 初始化
     */
    function init() {
        async function transform(file, enc, next) {
            if (!inited) {
                // 找出所有依赖包
                pkgList = await checkPackage.checkAllPkgs(file.cwd || process.cwd());
                // 筛选出小程序专用 npm 依赖包
                Object.keys(pkgList).forEach(pkgName => {
                    const pkg = pkgList[pkgName];
                    if (pkg.isMiniprogramPkg && pkg.buildPath) {
                        mpPkgMathMap[pkgName] = pkg.buildPath;
                    }
                });
                inited = true;
            }
            next(null, file);
        }
        return through.obj(transform);
    }

    /** extractComps
     * 提取小程序 npm 组件依赖, 将依赖文件追加至 stream 流中
     */
    function extractComps() {
        const extracted = {}; // 已提取的组件文件夹路径

        async function transform(file, enc, next) {
            const stream = this;
            if (file.isNull()) return next(null, file);

            // 如果不是 json 文件, 则跳过
            if (file.extname !== '.json') return next(null, file);

            const fileContent = String(file.contents); // 获取文件内容
            // 找出小程序组件依赖树
            const compTree = await lookupComponents(fileContent, file.path, {
                alias: mpPkgMathMap
            });
            // 展开树并去重处理为映射
            const npmComponents = treeToList(compTree, 'tree');
            // 展开依赖包构建路径列表
            const pathGlobs = Object.keys(npmComponents)
                .filter(e => !extracted[e])
                .map(compPath => path.join(compPath, '**'));

            if (!pathGlobs.length) return next(null, file);

            return lead(vfs.src(pathGlobs)
                // 添加信息
                .pipe(through.obj((depFile, depEnc, depNext) => {
                    if (depFile.isNull()) return depNext(null, depFile);

                    const originPath = depFile.path;
                    const { packageName } = checkPackage.resolveDepFile(originPath);
                    if (!packageName) return depNext(null, depFile);

                    depFile.packageName = packageName;

                    // stream.push 追加文件
                    stream.push(depFile);
                    return depNext(null, depFile);
                }))
                .on('finish', () => {
                    // 打印日志
                    Object.keys(npmComponents).forEach((componentPath) => {
                        const { moduleId } = npmComponents[componentPath];
                        // 记录提取
                        if (!extracted[componentPath]) {
                            extracted[componentPath] = true;
                            // 打印出根首层依赖的日志
                            if (compTree[componentPath]) logger.info('[mp-npm]', `Extracted \`${moduleId}\``);
                        }
                    });
                    next(null, file);
                })
                .on('error', next));
        }

        return through.obj(transform);
    }

    /** extractDeps
     * 提取普通依赖文件, 将依赖文件追加至 stream 流中
     */
    function extractDeps() {
        const extracted = []; // 已提取的依赖名

        async function transform(file, enc, next) {
            const stream = this;
            if (file.isNull()) return next(null, file);

            // 找出文件依赖树
            const tree = await lookupDependencies(file.path, {
                alias: mpPkgMathMap
            });
            // 展开树并去重处理为映射
            const depMap = treeToList(tree, 'tree');
            // 展开依赖文件路径列表
            const depPaths = Object.keys(depMap).filter(e => !extracted[e]);

            if (!depPaths.length) return next(null, file);

            return lead(vfs.src(depPaths)
                // 添加信息
                .pipe(through.obj((depFile, depEnc, depNext) => {
                    if (depFile.isNull()) return depNext(null, depFile);

                    const originPath = depFile.path;

                    const matchedDep = depMap[originPath]; // 找到匹配依赖信息
                    if (!matchedDep) return depNext(null, depFile);

                    const { name: packageName, moduleId } = matchedDep;
                    depFile.packageName = packageName;
                    depFile.moduleId = moduleId;

                    // 记录提取
                    if (!extracted[depFile.path]) {
                        extracted[depFile.path] = true;
                        // 打印出根首层依赖的日志
                        if (tree[originPath]) logger.info('[mp-npm]', `Extracted \`${moduleId}\``);
                    }

                    // stream.push 追加文件
                    stream.push(depFile);
                    return depNext(null, depFile);
                }))
                .on('finish', () => next(null, file))
                .on('error', next));
        }
        return through.obj(transform);
    }

    /** adjustPath
     * 调整文件及引用路径, 保证正确的输出
     */
    function adjustPath() {
        async function transform(file, enc, next) {
            if (file.isNull()) return next(); // 不输出空文件

            const { packageName, moduleId } = file;

            // 去掉小程序专用 npm 依赖包路径中的 buildPath 部分
            let filepath = file.path;
            Object.keys(mpPkgMathMap).forEach((pkgName) => {
                const pkg = pkgList[pkgName];
                // build 相对路径
                const buildRelativePath = pkg.isMiniprogramPkg
                    ? path.relative(pkg.path, pkg.buildPath) : '';
                    // 替换路径
                filepath = filepath.replace(
                    path.join('node_modules', pkgName, buildRelativePath),
                    path.join('node_modules', pkgName)
                );
            });

            // 以 node_modules 分割路径
            const separator = '/node_modules/';
            const pathSplit = filepath.replace(/\\/g, '/').split(separator);

            // 仅 npm 需要重写 file.base
            // 取 pathSplit[0] 作为 path.base 用于 dest 替换
            if (packageName && pathSplit.length > 1) file.base = pathSplit[0];

            // 重写 file.path
            // 以 npmDirname 替换 node_modules 将路径拼接
            file.path = replaceNodeModulesPath(filepath, npmDirname);

            // 如果是导出文件夹为官方小程序 miniprogram_npm 方案 并且 当引入依赖的是模块主入口时
            if (npmDirname === defaultNpmDirname && packageName && packageName === moduleId) {
                // 需将入口重写至 index.js
                pathSplit[pathSplit.length - 1] = path.join(packageName, `index${file.extname || '.js'}`);
                file.path = pathSplit.join(`/${npmDirname}/`);
            }

            // 重写源代码中模块引用依赖的moduleId
            file = rewriteModuleId(file, pkgList, npmDirname);

            return next(null, file);
        }

        return through.obj(transform);
    }

    /**
     * start
     */
    const pipeline = [
        init(),
        extractComps(),
        extractDeps(),
        adjustPath(),
    ];

    return lead(pumpify.obj(pipeline));
};
