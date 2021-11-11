const path = require('path');
const fs = require('fs');
const glob = require('glob');
const diff = require('lodash/difference')
const { slash } = require('../lib/utils');
const utils = require('./utils');

const integrationFixtures = path.join(__dirname, 'fixtures/integration-test');
const integrationExpected = path.join(__dirname, 'expected/integration-test');
const integrationTemp = path.join(__dirname, 'temp/integration-test');

// config
jest.setTimeout(30000);
jest.mock('fancy-log');

beforeEach(() => {
    jest.resetModules();
});

// tests
describe('集成测试', () => {

    test('mp-gulpfile 模板项目集成测试', (done) => {
        const output = 'default';
        testIntegration(output, done)
    });

    // test('自定义 npmDirname 提取文件夹集成测试', (done) => {
    //     const output = 'customize-npmDirname';
    //     global.mpNpmOptions = { npmDirname: 'dist' };
    //     testIntegration(output, done)
    // });

});

// 测试集成用例
function testIntegration(output, done) {
    const tempOutput = path.join(integrationTemp, output)
    const expectedOutput = path.join(integrationExpected, output);
    const gulpfilePath = path.join(integrationFixtures, 'gulpfile.js');
    global.src = path.join(integrationFixtures, 'src');
    global.dist = tempOutput; // expectedOutput
    const gulpfile = jest.requireActual(gulpfilePath);
    gulpfile.build(() => {
        setTimeout(() => {
            compareOutput(tempOutput, expectedOutput, done);
        }, 2000);
    });
}

// 对比结果
function compareOutput(temp, expected, done) {
    // const actualFiles = [];
    // const expectFiles = glob.sync(`${slash(expected)}/**`, { absolute: true, nodir: true }); // 预期文件目录结构
    // const tempFiles = glob.sync(`${slash(temp)}/**`, { absolute: true, nodir: true }); // 临时输出的文件

    // tempFiles.forEach(filepath => {
    //     expect(filepath).not.toBeNil();
    //     // 找到对应预期文件
    //     const expectPath = filepath.replace(slash(integrationTemp), slash(integrationExpected));
    //     expect(fs.existsSync(expectPath) ? expectPath : undefined)
    //         .toBe(expectPath);
    //     // 文件内容是否符合预期
    //     const actualContent = utils.normaliseEOL(fs.readFileSync(filepath, 'utf8'), 'strict')
    //     const expectContent = utils.normaliseEOL(fs.readFileSync(expectPath, 'utf8'), 'strict');
    //     if (actualContent.length > 5000 || expectContent.length > 5000) {
    //         expect(actualContent.length).toBe(expectContent.length);
    //     } else {
    //         expect(actualContent).toBe(expectContent);
    //     }
    //     actualFiles.push(expectPath);
    // });

    // // 实际比预期多出的文件
    // expect(diff(actualFiles, expectFiles)).toBeEmpty();
    // // 实际比预期缺少的文件
    // expect(diff(expectFiles, actualFiles)).toBeEmpty();

    done();
}
