const path = require('path');
const lead = require('lead');
const pumpify = require('pumpify');
const through = require('through2');
const vfs = require('vinyl-fs');
const changed = require('gulp-changed');
const logger = require('fancy-log');
const lookupComponents = require('./lib/lookupComponents');
const lookupDependencies = require('./lib/lookupDependencies');
// const rewriteModulesPath = require('./lib/rewriteModulePath');
const getNodeModulesPath = require('./lib/utils/getNodeModulesPath');
const getPackageName = require('./lib/utils/getPackageName');

const defaultNpmOutput = 'miniprogram_npm'; // 小程序官方方案默认输出路径

/** extractComps
 * 提取小程序组件专用 npm 包, 将依赖文件追加至 stream 流中
 */
function extractComps(npmOutput) {
    const extracted = {}; // 已提取的包名

    async function transform(file, enc, next) {
        const stream = this;
        if (file.isNull()) return next(null, file);

        // 如果不是 json 文件, 则跳过
        if (file.extname !== '.json') return next(null, file);

        // 如果是 json 文件, 尝试读取并寻找其声明的小程序组件专用 npm 包
        const npmComponents = {};
        const fileContent = String(file.contents); // 获取文件内容
        const comps = await lookupComponents(fileContent, file.path);
        Object.keys(comps).forEach(compExp => {
            const {
                name: packageName,
                buildPath,
                componentPath
            } = comps[compExp];
            if (extracted[componentPath]) return; // 如果该组件已提取, 则跳过
            npmComponents[packageName] = {
                buildPath,
                componentPath,
                pathGlob: path.join(componentPath, '**'),
            };
        });
        // 展开专用包构建路径列表
        const pathGlobs = Object.values(npmComponents).map(e => e.pathGlob);

        if (!pathGlobs.length) return next(null, file);

        return vfs.src(pathGlobs)
            // 修改 depFile.base 及 path, 去除 buildPath 对应的构建文件夹
            .pipe(through.obj((depFile, depEnc, depNext) => {
                if (depFile.isNull()) return depNext(null, depFile);

                const originPath = depFile.path;
                const nodeModulesPath = getNodeModulesPath(originPath); // 找到所在的 node_modules 文件夹
                const packageName = getPackageName(originPath); // 获取包名

                const { buildPath, componentPath } = npmComponents[packageName] || {};

                // 小程序组件 npm 专用包需要修改路径, 将 buildPath 文件夹修改为依赖的根目录
                if (componentPath && originPath.includes(componentPath)) {
                    // 找到文件在构建目录下的子路径
                    const buildRelativePath = path.relative(buildPath, originPath);
                    const outputPath = path.join(npmOutput, packageName, buildRelativePath);
                    depFile.path = path.join(nodeModulesPath, outputPath);
                    depFile.base = nodeModulesPath;
                    depFile.packageName = packageName;
                }

                return depNext(null, depFile);
            }))
            .on('data', (data) => {
                // stream.push 追加文件
                stream.push(data);
            })
            .on('finish', () => {
                // 打印日志
                Object.keys(npmComponents).forEach((packageName) => {
                    if (!extracted[packageName]) {
                        extracted[packageName] = true;
                        logger.info('[mp-npm]', `Extracted \`${packageName}\``);
                    }
                });
                next(null, file);
            })
            .on('error', next);
    }

    return through.obj(transform);
}

/** extractDeps
 * 提取普通依赖树, 将依赖文件追加至 stream 流中
 */
// TODO 支持分析 wxss 的依赖引入
function extractDeps(npmOutput) {
    const extracted = []; // 已提取的依赖名

    async function transform(file, enc, next) {
        const stream = this;
        if (file.isNull()) return next(null, file);

        // 找出文件依赖树
        const tree = lookupDependencies(file.path);
        // 展开树并去重处理为映射
        const depMap = lookupDependencies.treeToMap(tree);
        // 展开依赖文件路径列表
        const depPaths = Object.keys(depMap).filter(e => !extracted[e]);

        if (!depPaths.length) return next(null, file);

        return vfs.src(depPaths)
            // 修改 depFile.base | path
            .pipe(through.obj((depFile, depEnc, depNext) => {
                if (depFile.isNull()) return depNext(null, depFile);

                const originPath = depFile.path;
                const nodeModulesPath = getNodeModulesPath(originPath); // 找到所在的 node_modules 文件夹
                const relativePath = path.relative(nodeModulesPath, originPath);

                const { name: packageName, expression } = depMap[originPath];
                const outputPath = path.join(npmOutput, relativePath);
                depFile.path = path.join(nodeModulesPath, outputPath);
                depFile.base = nodeModulesPath;
                depFile.packageName = packageName;
                depFile.isPackageMain = packageName === expression; // 文件是否为模块的主入口
                // 打印根依赖日志
                if (!extracted[depFile.path]) {
                    extracted[depFile.path] = true;
                    if (tree[originPath]) logger.info('[mp-npm]', `Extracted \`${expression}\``);
                }

                return depNext(null, depFile);
            }))
            .on('data', (data) => {
                // stream.push 追加文件
                stream.push(data);
            })
            .on('finish', () => next(null, file))
            .on('error', next);
    }
    return through.obj(transform);
}

/** adjustPath
 * 调整文件及引用路径, 保证正确的输出
 */
function adjustPath(npmOutput) {
    async function transform(file, enc, next) {
        if (file.isNull()) return next(); // 不输出空文件
        const { isPackageMain, packageName } = file;

        // 过滤掉非 node_modules 的文件
        if (!getNodeModulesPath(file.path) || !packageName) return next(); // 不输出非 npm 文件

        /* 不同方案下的文件路径修改 */
        // 如果是导出文件夹为官方小程序 miniprogram_npm 方案
        if (npmOutput === defaultNpmOutput) { // 那么当引入依赖的是模块主入口时，需将入口重写至 index.js
            if (isPackageMain) {
                file.path = path.join(file.base, npmOutput, packageName, `index${path.extname(file.path) || '.js'}`);
            }
        } else { // 否则需将原代码中引用依赖的表达式路径加上 npmOutput
            // let fileContent = String(file.contents); // 获取文件内容
            // fileContent = rewriteModulesPath(fileContent, npmOutput);
            // file.contents = Buffer.from(fileContent);
        }

        return next(null, file);
    }

    return through.obj(transform);
}

/**
 * gulp-mp-npm
 */
function mpNpm(destPath, npmOutput = defaultNpmOutput, options = {}) {
    let pipeline = [
        extractComps(npmOutput),
        extractDeps(npmOutput),
        adjustPath(npmOutput),
    ];

    if (destPath) {
        pipeline = pipeline.concat([
            changed(destPath),
            vfs.dest(destPath),
        ]);
    }

    return lead(pumpify.obj(pipeline));
}

module.exports = mpNpm;
