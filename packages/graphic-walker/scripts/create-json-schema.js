const { resolve } = require('path');
const fs = require('fs');
const tsj = require('ts-json-schema-generator');
/** @type {import('ts-json-schema-generator/dist/src/Config').Config} */
const config = {
    path: resolve(__dirname, '../src/interfaces.ts'),
    tsconfig: resolve(__dirname, '../tsconfig.json'),
    type: '*',
    topRef: false,
};

const generator = tsj.createGenerator(config);
if (!fs.existsSync(resolve(__dirname, '../public'))) {
    fs.mkdirSync(resolve(__dirname, '../public'));
}
fs.writeFileSync(resolve(__dirname, '../public/chartinfo.json'), JSON.stringify(generator.createSchema('IChart'), undefined, 4));
fs.writeFileSync(resolve(__dirname, '../public/stoinfo_v2.json'), JSON.stringify(generator.createSchema('IStoInfoV2'), undefined, 4));
