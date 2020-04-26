const path = require('path');
const slash = require('slash');
const fs = require('fs');
const del = require('del');
const gulp = require('gulp');
const glob = require('glob');
const mkdirp = require('mkdirp');
const diff = require('lodash/difference')
const utils = require('./utils');
jest.mock('console');
const mpNpm = require('../index');

const unitFixtures = path.join(__dirname, 'fixtures/unit-test');
const unitExpected = path.join(__dirname, 'expected/unit-test');
const watchTemp = path.join(__dirname, 'temp/watch');

// config
jest.setTimeout(30000);
beforeEach(() => {
    mkdirp.sync(watchTemp);
});

// tests
describe('watch 模式', () => {

    test('修改 js 新增引入普通 npm 依赖', (done) => {
        const target = 'import-normal-dep.js';
        const expectedDir = 'import-normal-dep.js/';
        const originContent = readUnitCaseFile(target);
        const firstLine = originContent.split('\n')[0];
        testWatch(target, expectedDir, firstLine, originContent, done);
    });

    test('修改 js 删除引入普通 npm 依赖', (done) => {
        const target = 'import-normal-dep.js';
        const expectedDir = 'import-normal-dep.js/';
        const originContent = readUnitCaseFile(target);
        const tempContent = `import mitt from 'mitt';\n` + originContent;
        testWatch(target, expectedDir, tempContent, originContent, done);
    });

    test('修改 js 新增引入小程序专用 npm 组件', (done) => {
        const target = 'import-special-dep.js';
        const expectedDir = 'import-special-dep.js/';
        const originContent = readUnitCaseFile(target);
        const firstLine = originContent.split('\n')[0];
        testWatch(target, expectedDir, firstLine, originContent, done);
    });

});

// 测试文件监听
function testWatch(tempFile, expectedDir, oldContent, newContent, done) {
    createTempFile(tempFile, oldContent);
    const watcher = gulp.on('error', done)
        .watch(tempFile, { cwd: watchTemp, delay: 500 }, (cb) => {
            testTempCase(tempFile, expectedDir, (res) => {
                watcher.close();
                cb();
                done(res);
            });
        });
    updateTempFile(tempFile, newContent);
}

function readUnitCaseFile(originFile) {
    const filePath = path.resolve(unitFixtures, originFile);
    return fs.readFileSync(filePath, 'utf8');
}

function createTempFile(tempFile, content) {
    const filePath = path.resolve(watchTemp, tempFile);
    del.sync(filePath);
    updateTempFile(filePath, content);
}

function updateTempFile(tempFile, content) {
    const filePath = path.resolve(watchTemp, tempFile);
    setTimeout(() => {
        fs.writeFileSync(filePath, content);
    }, 500);
}

// 执行并测试单元用例
function testTempCase(input, output, done, options = {}) {
    const actualFiles = []; // 实际文件目录结构
    const expectFiles = glob.sync(`${slash(output)}/**`, { cwd: unitExpected, base: unitExpected, absolute: true, nodir: true }); // 预期文件目录结构
    gulp.src(slash(input), { cwd: watchTemp, base: watchTemp, nodir: true })
        .pipe(mpNpm(options.mpNpmOptions))
        .on('error', done)
        .on('data', (file) => {
            expect(file).not.toBeNil();
            expect(file.path).not.toBeNil();
            expect(file.base).not.toBeNil();
            expect(file.contents).not.toBeNil();
            // 找到预期文件
            const relativePath = file.relative || path.relative(file.base, file.path);
            const expectPath = path.resolve(path.join(unitExpected, output), relativePath);
            expect(fs.existsSync(expectPath) ? expectPath : undefined)
                .toBe(expectPath);
            // 文件内容是否符合预期
            const actualContent = utils.normaliseEOL(file.contents)
            const expectContent = utils.normaliseEOL(fs.readFileSync(expectPath, 'utf8'));
            if (actualContent.length > 5000 || expectContent.length > 5000) {
                expect(actualContent.length).toBe(expectContent.length);
            } else {
                expect(actualContent).toBe(expectContent);
            }
            actualFiles.push(slash(expectPath));
        })
        .on('end', () => {
            // 实际比预期多出的文件 (watch模式下不用对比)
            //expect(diff(actualFiles, expectFiles)).toBeEmpty();
            // 实际比预期缺少的文件
            expect(diff(expectFiles, actualFiles)).toBeEmpty();
            done();
        });
}
