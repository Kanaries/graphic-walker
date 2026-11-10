import { displayValue } from './keys';
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
export const fieldTime = (field: FieldInstance, raw: unknown) => timeValue(raw) + (field.timeOffset ?? 0);

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
const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en', { timeZone: 'UTC', ...options });
const formats = {
    year: part({ year: 'numeric' }),
    month: part({ month: 'short' }),
    monthYear: part({ month: 'short', year: 'numeric' }),
    day: part({ month: 'short', day: 'numeric' }),
    time: part({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    seconds: part({ hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }),
    date: part({ year: 'numeric', month: 'short', day: 'numeric' }),
    dateTime: part({ year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
};
/** A date for tooltips: the day, with the time of day unless it is midnight. */
export const formatTime = (ms: number) => Number.isFinite(ms) ? (ms % day === 0 ? formats.date : formats.dateTime).format(ms) : '';

const two = (n: number) => String(n).padStart(2, '0');
// ISO 8601 week: weeks start on Monday and week 1 holds the year's first Thursday.
function isoWeek(ms: number): [number, number] {
    const date = new Date(ms);
    const thursday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 3 - (date.getUTCDay() + 6) % 7);
    const year = new Date(thursday).getUTCFullYear();
    return [year, 1 + Math.round((thursday - Date.UTC(year, 0, 4)) / (7 * day))];
}
/** The name of the calendar period that starts at `ms`, such as 2024, 2024 Q3 or 2024-07. */
export function formatPeriod(ms: number, unit?: TimeUnit): string {
    if (!Number.isFinite(ms)) return '';
    if (!unit) return formatTime(ms);
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
/** What a member of a discrete field is called: a date for a time field, the value itself otherwise. */
export function memberLabel(field: FieldInstance | undefined, value: Value): string {
    if (field?.scale !== 'time' || value == null) return displayValue(value);
    return formatPeriod(fieldTime(field, value), field.timeUnit) || displayValue(value);
}

/** Calendar ticks for a time range. The domain stays the data range, like tickScale. */
export function timeScale(min: number, max: number, pixels: number, gap: number): AxisScale {
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
        if (spacing.unit === 'year') return formats.year.format(t);
        // The year shows where it changes, and on the first tick so a range inside one year still names it.
        if (spacing.unit === 'month') return date.getUTCMonth() === 0 ? formats.year.format(t) : i === 0 ? formats.monthYear.format(t) : formats.month.format(t);
        if (spacing.unit === 'day' || spacing.unit === 'week' || t % day === 0) return formats.day.format(t);
        return (spacing.unit === 'second' ? formats.seconds : formats.time).format(t);
    });
    return { domain: [min, max], ticks, labels };
}
