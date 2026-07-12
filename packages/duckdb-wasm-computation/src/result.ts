import { bigNumToString } from 'apache-arrow/util/bn';

interface ArrowTypeLike {
    scale?: number;
}

const numberOrExactString = (value: string): number | string => {
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : value;
};

const scaledIntegerToDecimalString = (value: string, scale: number): string => {
    const sign = value.startsWith('-') ? '-' : '';
    const digits = sign ? value.slice(1) : value;
    const padded = digits.padStart(scale + 1, '0');
    return `${sign}${padded.slice(0, -scale)}.${padded.slice(-scale)}`;
};

export const arrowToJSON = (value: any, type?: ArrowTypeLike): any => {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'bigint') return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
    if (Array.isArray(value)) return value.map((item) => arrowToJSON(item));

    if (typeof value === 'object') {
        if (value.constructor?.name === 'Vector' && typeof value[Symbol.iterator] === 'function') {
            return Array.from(value as Iterable<unknown>).map((item) => arrowToJSON(item));
        }
        if (value.constructor?.name?.includes('BigNum')) {
            const integer = bigNumToString(value);
            if (type?.scale) {
                const decimal = Number(integer) / 10 ** type.scale;
                return Number.isSafeInteger(Number(integer)) ? decimal : scaledIntegerToDecimalString(integer, type.scale);
            }
            return numberOrExactString(integer);
        }
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, arrowToJSON(item)]));
    }

    return value;
};

interface ArrowTableLike {
    schema?: { fields?: Array<{ name: string; type?: ArrowTypeLike }> };
    toArray(): Array<{ toJSON(): Record<string, unknown> }>;
}

export const transformData = (table: ArrowTableLike) => {
    const fieldTypes = new Map(table.schema?.fields?.map((field) => [field.name, field.type]) ?? []);
    return table
        .toArray()
        .map((row) => Object.fromEntries(Object.entries(row.toJSON()).map(([key, value]) => [key, arrowToJSON(value, fieldTypes.get(key))])));
};
