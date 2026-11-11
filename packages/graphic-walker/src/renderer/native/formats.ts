import { format as numberFormat } from 'd3-format';
import { timeFormatLocale, type TimeLocaleDefinition } from 'd3-time-format';
import type { Formats, Words } from '@kanaries/worksheet-renderer';
import type { IVisualLayout } from '../../interfaces';
import { getVegaTimeFormatRules } from '../../vis/temporalFormat';

// The words the sheet writes itself, for the languages the editor ships, by language without region:
// the editor may report 'zh' as well as 'zh-CN'. Other languages read English.
const words: Record<string, Partial<Words>> = {
    zh: {
        share: '占比', upperWhisker: '上须', upperQuartile: '上四分位数', median: '中位数', lowerQuartile: '下四分位数', lowerWhisker: '下须',
        records: '记录数', more: (count) => `另有 ${count} 项`, empty: '没有符合筛选条件的数据',
    },
    ja: {
        share: '割合', upperWhisker: '上ひげ', upperQuartile: '第3四分位数', median: '中央値', lowerQuartile: '第1四分位数', lowerWhisker: '下ひげ',
        records: 'レコード数', more: (count) => `他 ${count} 件`, empty: 'フィルターに一致するデータがありません',
    },
};

/**
 * The chart's format settings and the editor's language, as the worksheet takes them.
 * The settings are d3 format strings, as for the editor's other renderers. A string d3 cannot
 * read is reported and left out, so the chart keeps its standard format instead of failing.
 */
export function chartFormats(format: IVisualLayout['format'], locale: string): { formats: Formats; problems: string[] } {
    const problems: string[] = [];
    const attempt = <T>(name: string, specifier: string | undefined, make: (specifier: string) => (value: T) => string) => {
        if (!specifier) return undefined;
        try {
            const made = make(specifier);
            return (value: T) => made(value);
        } catch (error) {
            problems.push(`The ${name} "${specifier}" is not a format d3 can read: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    };
    // Times reach the sheet already shifted to the display zone, to be read as UTC.
    const dates = timeFormatLocale(getVegaTimeFormatRules(locale) as TimeLocaleDefinition);
    return {
        formats: {
            locale,
            number: attempt<number>('number format', format?.numberFormat, numberFormat),
            share: attempt<number>('normalized number format', format?.normalizedNumberFormat, numberFormat),
            time: attempt<number>('time format', format?.timeFormat, (specifier) => { const made = dates.utcFormat(specifier); return (ms) => made(new Date(ms)); }),
            words: words[locale.split('-')[0]],
        },
        problems,
    };
}
