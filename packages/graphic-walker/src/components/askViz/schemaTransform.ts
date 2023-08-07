import { Specification } from "../../interfaces";

export function parseGW(vlSpec: any): Specification {
    const spec: Specification = {};
    if (vlSpec.encoding && vlSpec.mark) {
        spec.geomType = [vlSpec.mark];
        spec.position = [];
        if (vlSpec.encoding.x && vlSpec.encoding.x.field) {
            spec.position.push(vlSpec.encoding.x.field);
            if (vlSpec.encoding.x.aggregate) {
                spec.aggregate = true;
            }
        }
        if (vlSpec.encoding.y && vlSpec.encoding.y.field) {
            spec.position.push(vlSpec.encoding.y.field);
            if (vlSpec.encoding.y.aggregate) {
                spec.aggregate = true;
            }
        }
        spec.facets = [];
        if (vlSpec.encoding.row && vlSpec.encoding.row) {
            spec.facets.push(vlSpec.encoding.row);
        }
        if (vlSpec.encoding.column && vlSpec.encoding.column) {
            spec.facets.push(vlSpec.encoding.column);
        }

        ['color', 'opacity', 'shape', 'size'].forEach((ch) => {
            if (vlSpec.encoding[ch] && vlSpec.encoding[ch].field) {
                spec[ch] = [vlSpec.encoding[ch].field];
                if (vlSpec.encoding[ch].aggregate) {
                    spec.aggregate = true;
                }
            }
        });
    }
    return spec;
}