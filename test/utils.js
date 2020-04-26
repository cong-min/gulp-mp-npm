const normaliseEOL = (str = '', tag) => {
    str = str.toString('utf8').replace(/\r\n/g, '\n').trim();
    if (tag === 'strict') str = str.replace(/\\r\\n/g, '\\n');
    return str;
};

module.exports = {
    normaliseEOL,
};
