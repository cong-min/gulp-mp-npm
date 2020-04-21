const normaliseEOL = str => str.toString('utf8').replace(/\r\n/g, '\n');

module.exports = {
    normaliseEOL,
};
