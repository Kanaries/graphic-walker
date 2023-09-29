import { IField } from "../interfaces";

// TODO: make property with couping effect as readonly, and implements a setFunction to edit those prop with those effects.
export class Field<T extends IField> {
    protected _field: T;
    constructor (f: T) {
        this._field = f;
    }
    public asDimension (): T {
        this._field.analyticType = 'dimension';
        return this._field
    }
    public asMeasure (): T {
        this._field.analyticType = 'measure';
        this._field.aggName = 'sum';
        this._field.semanticType = 'quantitative'
        return this._field
    }
    public asGeo(role: T['geoRole']): T {
        this._field.geoRole = role;
        if (role === 'longitude') {
            this._field.semanticType = 'quantitative';
            this._field.analyticType = 'dimension';
        }
        if (role === 'latitude') {
            this._field.semanticType = 'quantitative';
            this._field.analyticType = 'measure'
        }
        return this._field
    }
    public switchAnalyticType (analyticType: T['analyticType'] | string): T {
        if (analyticType === 'dimension') {
            return this.asDimension();
        } else if (analyticType === 'measure') {
            return this.asMeasure();
        }
        return this._field
    }
}