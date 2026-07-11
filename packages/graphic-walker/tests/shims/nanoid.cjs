/**
 * CommonJS stand-in for `nanoid` used only by Jest (see moduleNameMapper).
 * nanoid >= 4 ships pure ESM, which Jest's CJS runtime cannot require, and
 * mapping into node_modules broke whenever hoisting changed the installed
 * version. Mirrors the upstream secure implementation.
 */
const crypto = require('crypto');

const urlAlphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

const nanoid = (size = 21) => {
    const bytes = crypto.randomBytes(size);
    let id = '';
    while (size--) {
        id += urlAlphabet[bytes[size] & 63];
    }
    return id;
};

const customAlphabet = (alphabet, defaultSize = 21) => {
    return (size = defaultSize) => {
        const bytes = crypto.randomBytes(size);
        let id = '';
        while (size--) {
            id += alphabet[bytes[size] % alphabet.length];
        }
        return id;
    };
};

module.exports = { nanoid, customAlphabet, urlAlphabet };
