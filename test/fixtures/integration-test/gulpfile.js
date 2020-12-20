/* 基于 mp-gulpfile 修改 */
const path = require('path');
const del = require('del');
const gulp = require('gulp');
const gulpTs = require('gulp-typescript');
const gulpif = require('gulp-if');
const sourcemaps = require('gulp-sourcemaps');
const gulpLess = require('gulp-less');
const rename = require('gulp-rename');
const jsonfile = require('jsonfile');
const mpNpm = require('../../../index');

const resolve = (...args) => path.resolve(__dirname, ...args);

/* config */
const src = global.src || 'src';
const dist = global.dist || '.miniprogram';

const sourcemap = {
    ts: true, // 是否开启 ts sourcemap
    less: true, // 是否开启 less sourcemap
};
// options
const srcOptions = global.srcOptions || { base: src };
const watchOptions = global.watchOptions || { events: ['add', 'change'] };
const mpNpmOptions = global.mpNpmOptions || { npmDirname: 'miniprogram_npm', fullExtract: ['weui-miniprogram', 'mitt/dist'] };

// 文件匹配路径
const globs = {
    ts: `${src}/**/*.ts`, // 匹配 ts 文件
    js: `${src}/**/*.js`, // 匹配 js 文件
    json: `${src}/**/*.json`, // 匹配 json 文件
    less: `${src}/**/*.less`, // 匹配 less 文件
    wxss: `${src}/**/*.wxss`, // 匹配 wxss 文件
};
globs.copy = [`${src}/**`,
    `!${globs.ts}`, `!${globs.js}`, `!${globs.json}`,
    `!${globs.less}`, `!${globs.wxss}`]; // 匹配需要拷贝的文件

/** `gulp clear`
 * 清理文件
 * */
const clear = () => del(dist);

/** `gulp copy`
 * 清理
 * */
const copy = () => gulp.src(
    globs.copy,
    { ...srcOptions, since: gulp.lastRun(copy) },
)
    .pipe(gulp.dest(dist));

/** `gulp ts`
 * 编译ts
 * */
const tsProject = gulpTs.createProject(resolve('tsconfig.json'));
const ts = () => gulp.src(
    globs.ts,
    { ...srcOptions, since: gulp.lastRun(ts) },
)
    .pipe(gulpif(sourcemap.ts, sourcemaps.init()))
    .pipe(tsProject()) // 编译ts
    .pipe(mpNpm(mpNpmOptions)) // 分析依赖
    .pipe(gulpif(sourcemap.ts, sourcemaps.write('.')))
    .pipe(gulp.dest(dist));

/** `gulp js`
 * 解析js
 * */
const js = () => gulp.src(
    globs.js,
    { ...srcOptions, since: gulp.lastRun(js) },
)
    .pipe(mpNpm(mpNpmOptions)) // 分析依赖
    .pipe(gulp.dest(dist));

/** `gulp json`
 * 解析json
 * */
const json = () => gulp.src(
    globs.json,
    { ...srcOptions, since: gulp.lastRun(json) },
)
    .pipe(mpNpm(mpNpmOptions)) // 分析依赖
    .pipe(gulp.dest(dist));

/** `gulp less`
 * 编译less
 * */
const less = () => gulp.src(
    globs.less,
    { ...srcOptions, since: gulp.lastRun(less) },
)
    .pipe(gulpif(sourcemap.less, sourcemaps.init()))
    .pipe(gulpLess()) // 编译less
    .pipe(rename({ extname: '.wxss' }))
    .pipe(mpNpm(mpNpmOptions)) // 分析依赖
    .pipe(gulpif(sourcemap.less, sourcemaps.write('.')))
    .pipe(gulp.dest(dist));

/** `gulp wxss`
 * 解析wxss
 * */
const wxss = () => gulp.src(
    globs.wxss,
    { ...srcOptions, since: gulp.lastRun(wxss) },
)
    .pipe(mpNpm(mpNpmOptions)) // 分析依赖
    .pipe(gulp.dest(dist));

// 不清理 dist 的构建
const _build = gulp.parallel(
    copy,
    ts,
    js,
    json,
    less,
    wxss,
);

// 将 miniprogramRoot 配置修改为 dist 路径
const config = async () => {
    const project = jsonfile.readFileSync(resolve('project.config.json'), { throws: false });
    if (project) {
        project.miniprogramRoot = '/';
        jsonfile.writeFileSync(resolve(dist, 'project.config.json'), project, { spaces: 2 });
    }
};

/** `gulp build`
 * 构建
 * */
const build = gulp.series(
    clear,
    _build,
    config,
);

/** `gulp watch`
 * 监听
 * */
const watch = () => {
    gulp.watch(globs.copy, watchOptions, copy);
    gulp.watch(globs.ts, watchOptions, ts);
    gulp.watch(globs.js, watchOptions, js);
    gulp.watch(globs.json, watchOptions, json);
    gulp.watch(globs.less, watchOptions, less);
    gulp.watch(globs.wxss, watchOptions, wxss);
};

/** `gulp` or `gulp dev`
 * 构建并监听
 * */
const dev = gulp.series(
    clear,
    build,
    watch,
);

// `gulp --tasks` list tasks
module.exports = {
    clear,
    copy,
    ts,
    less,
    build,
    watch,
    dev,
    default: dev,
};
