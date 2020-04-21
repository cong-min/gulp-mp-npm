const path = require('path');
const gulp = require('gulp');
const mpNpm = require('../index');

const input = path.join(__dirname, 'input');
const output = path.join(__dirname, 'output');

function build(path, status) {
    gulp.src(path)
        .pipe(mpNpm())
        .pipe(gulp.dest(output + '/case-watch'));
}

const watcher = gulp.watch(input + '/**')

watcher.on('change', build);
watcher.on('add', build);

build(input + '/**');
