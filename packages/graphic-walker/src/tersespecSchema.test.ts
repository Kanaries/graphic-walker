import fs from 'fs';
import path from 'path';

// The TerseSpec schema is generated into this package by `yarn gen-schema`. The playground keeps the
// copy that is served to the public. Both must accept what the types accept.
const read = (file: string) => JSON.parse(fs.readFileSync(path.resolve(__dirname, file), 'utf8'));
const library = read('../public/tersespec_v1.json');
const published = read('../../playground/public/tersespec_v1.json');

describe('the TerseSpec JSON Schema', () => {
    it('lets a TopoJSON address name the object to draw', () => {
        for (const schema of [library, published]) {
            expect(schema.definitions.IGeoUrl.properties.objectKey).toEqual(expect.objectContaining({ type: 'string' }));
        }
    });

    it('is the same in the playground as in the library', () => {
        expect(published).toEqual(library);
    });
});
