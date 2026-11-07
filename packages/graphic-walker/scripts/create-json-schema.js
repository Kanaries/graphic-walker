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
// Both published schema locations use the same canonical types and schema URLs.
for (const directory of [resolve(__dirname, '../public'), resolve(__dirname, '../../playground/public')]) {
    fs.mkdirSync(directory, { recursive: true });
    for (const [type, filename] of [['IChart', 'chartinfo.json'], ['IStoInfoV2', 'stoinfo_v2.json'], ['TerseSpec', 'tersespec_v1.json']]) {
        fs.writeFileSync(resolve(directory, filename), JSON.stringify(generator.createSchema(type), undefined, 4));
    }
}
