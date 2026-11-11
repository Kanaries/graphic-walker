import { resolveFormats, type Format } from './formats';
import { displayValue, isRange } from './keys';
import { resultKey, type AxisScale, type FieldInstance, type Row, type TimeUnit, type Value } from './types';

/** Milliseconds since the epoch for a Date, an ISO string or a number. NaN for null or anything unreadable. */
export function timeValue(raw: unknown): number {
    if (raw == null) return NaN;
    if (raw instanceof Date) return raw.getTime();
    if (typeof raw === 'number') return raw;
    return typeof raw === 'string' ? Date.parse(raw) : NaN;
}
/** The number a continuous field places a record at. NaN when the record has no value. */
export function positionValue(field: FieldInstance, record: Row): number {
    const raw = record[resultKey(field)];
    return field.scale === 'time' ? fieldTime(field, raw) : raw == null ? NaN : Number(raw);
}
/** The time a time field stands for, with the field's own offset applied. */
export function fieldTime(field: FieldInstance, raw: unknown): number {
    const offset = field.timeOffset ?? 0;
    if (typeof offset === 'number') return timeValue(raw) + offset;
    return timeValue(raw) + (typeof raw !== 'string' ? offset.epoch : /^\d{4}(-\d{2}(-\d{2})?)?$/.test(raw.trim()) ? offset.date : offset.dateTime);
}

const second = 1000, minute = 60 * second, hour = 60 * minute, day = 24 * hour;
type Unit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
// Candidate tick spacings, smallest first. Months and years step on the calendar, the rest on fixed durations.
const spacings: { unit: Unit; count: number; size: number }[] = [
    ...[1, 5, 15, 30].map(count => ({ unit: 'second' as const, count, size: count * second })),
    ...[1, 5, 15, 30].map(count => ({ unit: 'minute' as const, count, size: count * minute })),
    ...[1, 3, 6, 12].map(count => ({ unit: 'hour' as const, count, size: count * hour })),
    ...[1, 2].map(count => ({ unit: 'day' as const, count, size: count * day })),
    { unit: 'week', count: 1, size: 7 * day },
    ...[1, 2, 3, 6].map(count => ({ unit: 'month' as const, count, size: count * 30.44 * day })),
    ...[1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].map(count => ({ unit: 'year' as const, count, size: count * 365.25 * day })),
];
// All calendar arithmetic and labels are in UTC, so a sheet looks the same on every machine.
const two = (n: number) => String(n).padStart(2, '0');
// ISO 8601 week: weeks start on Monday and week 1 holds the year's first Thursday.
function isoWeek(ms: number): [number, number] {
    const date = new Date(ms);
    const thursday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 3 - (date.getUTCDay() + 6) % 7);
    const year = new Date(thursday).getUTCFullYear();
    return [year, 1 + Math.round((thursday - Date.UTC(year, 0, 4)) / (7 * day))];
}
/** The name of the calendar period that starts at `ms`, such as 2024, 2024 Q3 or 2024-07. The same in every language. */
export function formatPeriod(ms: number, unit: TimeUnit): string {
    if (!Number.isFinite(ms)) return '';
    const date = new Date(ms), year = date.getUTCFullYear(), ymd = `${year}-${two(date.getUTCMonth() + 1)}-${two(date.getUTCDate())}`;
    switch (unit) {
        case 'year': return String(year);
        case 'quarter': return `${year} Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
        case 'month': return `${year}-${two(date.getUTCMonth() + 1)}`;
        case 'week': case 'day': return ymd;
        case 'hour': case 'minute': return `${ymd} ${two(date.getUTCHours())}:${two(date.getUTCMinutes())}`;
        case 'second': return `${ymd} ${two(date.getUTCHours())}:${two(date.getUTCMinutes())}:${two(date.getUTCSeconds())}`;
        case 'iso_year': return String(isoWeek(ms)[0]);
        case 'iso_week': { const [isoYear, week] = isoWeek(ms); return `${isoYear} W${two(week)}`; }
    }
}
/**
 * What a member of a discrete field is called. A member of a time field is named after its
 * period, or written as a moment when the field has no unit; a bin is written as its range.
 */
export function memberLabel(field: FieldInstance | undefined, value: Value, format: Format = resolveFormats()): string {
    if (value == null) return format.words.missing;
    if (isRange(value)) return value.map(format.number).join(' – ');
    if (field?.scale !== 'time') return displayValue(value);
    const ms = fieldTime(field, value);
    return (field.timeUnit ? formatPeriod(ms, field.timeUnit) : format.time(ms)) || displayValue(value);
}

/** Calendar ticks for a time range. The domain stays the data range, like tickScale. */
export function timeScale(min: number, max: number, pixels: number, gap: number, format: Format = resolveFormats()): AxisScale {
    const formats = format.date;
    if (min === max) { min -= day / 2; max += day / 2; }
    const wanted = Math.max(2, Math.floor(pixels / gap));
    // The spacing whose tick count is closest to the wanted one, compared as a ratio like the linear ticks.
    const distance = (size: number) => Math.abs(Math.log((max - min) / size / wanted));
    const spacing = spacings.reduce((best, next) => distance(next.size) < distance(best.size) ? next : best);
    const ticks: number[] = [];
    if (spacing.unit === 'month' || spacing.unit === 'year') {
        const months = spacing.unit === 'year' ? spacing.count * 12 : spacing.count;
        const start = new Date(min);
        let index = Math.ceil((start.getUTCFullYear() * 12 + start.getUTCMonth()) / months) * months;
        if (Date.UTC(Math.floor(index / 12), index % 12, 1) < min) index += months;
        for (let t = Date.UTC(Math.floor(index / 12), index % 12, 1); t <= max; index += months, t = Date.UTC(Math.floor(index / 12), index % 12, 1)) ticks.push(t);
    } else {
        // Weeks start on Monday; the epoch was a Thursday.
        const shift = spacing.unit === 'week' ? 4 * day : 0;
        for (let t = Math.ceil((min - shift) / spacing.size) * spacing.size + shift; t <= max; t += spacing.size) ticks.push(t);
    }
    const labels = ticks.map((t, i) => {
        const date = new Date(t);
        if (spacing.unit === 'year') return formats.year(t);
        // The year shows where it changes, and on the first tick so a range inside one year still names it.
        if (spacing.unit === 'month') return date.getUTCMonth() === 0 ? formats.year(t) : i === 0 ? formats.monthYear(t) : formats.month(t);
        if (spacing.unit === 'day' || spacing.unit === 'week' || t % day === 0) return formats.day(t);
        return (spacing.unit === 'second' ? formats.seconds : formats.time)(t);
    });
    return { domain: [min, max], ticks, labels };
}
