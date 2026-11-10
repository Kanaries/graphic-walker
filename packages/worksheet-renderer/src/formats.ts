/** The words the sheet writes itself. A host replaces them to match its language. */
export interface Words {
    share: string;
    upperWhisker: string; upperQuartile: string; median: string; lowerQuartile: string; lowerWhisker: string;
    records: string;
    /** The ends of a legend whose range differs from pane to pane. */
    low: string; high: string;
    /** What stands for a missing member. */
    missing: string;
    /** The end of a legend list that does not fit, for `count` entries left out. */
    more: (count: number) => string;
    /** Shown in place of a sheet whose queries returned nothing. */
    empty: string;
}
/**
 * How the sheet writes numbers, dates and its own words. Every part is optional; what is
 * left out follows `locale`.
 */
export interface Formats {
    /** A BCP 47 language tag such as 'en-US' or 'zh-CN'. English when absent. */
    locale?: string;
    /** A number in full: tooltips, labels and cells. */
    number?: (value: number) => string;
    /** A number on an axis or at the end of a legend. Follows `number` when that is given, else it is abbreviated. */
    tick?: (value: number) => string;
    /** A share between 0 and 1: the axis and tooltips of a normalized stack, the tooltip of a pie slice. */
    share?: (value: number) => string;
    /**
     * A moment, as milliseconds to be read in UTC: tooltips and labels of a time field, and the
     * members of a discrete time field that has no unit. Ticks of a time axis pick their own
     * format by the spacing between them and are not affected.
     */
    time?: (ms: number) => string;
    words?: Partial<Words>;
}
/** Formats with nothing left out. */
export interface Format {
    locale: string;
    number: (value: number) => string;
    tick: (value: number) => string;
    share: (value: number) => string;
    time: (ms: number) => string;
    /** Parts of a date for the ticks of a time axis, in UTC. */
    date: Record<'year' | 'month' | 'monthYear' | 'day' | 'time' | 'seconds', (ms: number) => string>;
    words: Words;
}
export const englishWords: Words = {
    share: 'Share', upperWhisker: 'Upper whisker', upperQuartile: 'Upper quartile', median: 'Median', lowerQuartile: 'Lower quartile', lowerWhisker: 'Lower whisker',
    records: 'Records', low: 'Low', high: 'High', missing: '(null)', more: count => `+${count} more`, empty: 'No data matches these filters.',
};
const day = 86_400_000;
const resolved = new WeakMap<Formats, Format>();
let fallback: Format | undefined;

/** Fills in what a host left out. The result is kept per input object, so resolving again is free. */
export function resolveFormats(formats?: Formats): Format {
    if (!formats) return fallback ??= build({});
    let made = resolved.get(formats);
    if (!made) resolved.set(formats, made = build(formats));
    return made;
}
function build(formats: Formats): Format {
    // A tag the runtime does not know falls back to English instead of failing the sheet.
    let locale = formats.locale ?? 'en';
    try { new Intl.NumberFormat(locale); } catch { locale = 'en'; }
    const plain = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
    const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
    const part = (options: Intl.DateTimeFormatOptions) => { const f = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }); return (ms: number) => f.format(ms); };
    const date = part({ year: 'numeric', month: 'short', day: 'numeric' });
    const dateTime = part({ year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    // A formatter of the host's must not take the sheet down with it on a value it cannot write.
    const safe = <T>(own: ((value: T) => string) | undefined, standard: (value: T) => string) => own ? (value: T) => { try { return String(own(value)); } catch { return standard(value); } } : standard;
    const number = safe(formats.number, (value: number) => plain.format(value));
    return {
        locale,
        number,
        tick: safe(formats.tick, formats.number ? number : (value: number) => compact.format(value)),
        share: safe(formats.share, (value: number) => percent.format(value)),
        // The day, with the time of day unless it is midnight.
        time: safe(formats.time, (ms: number) => Number.isFinite(ms) ? (ms % day === 0 ? date : dateTime)(ms) : ''),
        date: {
            year: part({ year: 'numeric' }), month: part({ month: 'short' }), monthYear: part({ month: 'short', year: 'numeric' }), day: part({ month: 'short', day: 'numeric' }),
            time: part({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }), seconds: part({ hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }),
        },
        words: { ...englishWords, ...formats.words },
    };
}
