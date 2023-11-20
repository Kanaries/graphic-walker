import { newOffsetDate } from './offset';

describe('getOffsetDate', () => {
    const offsetDate = newOffsetDate(-480);
    test('test get', () => {
        const date = offsetDate('2023-11-20T07:35:11.830Z');
        expect(date.getFullYear()).toBe(2023);
        expect(date.getMonth()).toBe(10);
        expect(date.getDate()).toBe(20);
        expect(date.getHours()).toBe(15);
        expect(date.getMinutes()).toBe(35);
        expect(date.getSeconds()).toBe(11);
        expect(date.getTime()).toBe(new Date('2023-11-20T07:35:11.830Z').getTime());
        expect(date.getTime()).toBe(offsetDate(date).getTime());
    });
    test('test set', () => {
        const getDate = () => offsetDate('2023-11-20T07:35:11.830Z');
        expect(getDate().setFullYear(2022)).toBe(offsetDate('2022-11-20T07:35:11.830Z').getTime());
        expect(getDate().setMonth(0)).toBe(offsetDate('2023-01-20T07:35:11.830Z').getTime());
        expect(getDate().setDate(1)).toBe(offsetDate('2023-11-01T07:35:11.830Z').getTime());
        expect(getDate().setHours(8)).toBe(offsetDate('2023-11-20T00:35:11.830Z').getTime());
        expect(getDate().setMinutes(45)).toBe(offsetDate('2023-11-20T07:45:11.830Z').getTime());
        expect(getDate().setSeconds(30)).toBe(offsetDate('2023-11-20T07:35:30.830Z').getTime());
    });
    test('simple test', () => {
        const date = offsetDate('2022-11-20T07:35:11.830Z');
        const _Y = date.getFullYear();
        expect(_Y).toBe(2022);
        const _firstDayOfYear = offsetDate(_Y, 0, 1);
        expect(_firstDayOfYear.getTime()).toBe(new Date('2021-12-31T16:00:00.000Z').getTime());
        const _SundayOfFirstWeek = offsetDate(offsetDate(_firstDayOfYear).setDate(_firstDayOfYear.getDate() - _firstDayOfYear.getDay()));
        expect(_SundayOfFirstWeek.getTime()).toBe(new Date('2021-12-25T16:00:00.000Z').getTime());
        const Y = date.getTime() - _SundayOfFirstWeek.getTime() > 1_000 * 60 * 60 * 24 * 7 ? _Y : _SundayOfFirstWeek.getFullYear();
        expect(Y).toBe(2022);
        const firstDayOfYear = offsetDate(Y, 0, 1);
        expect(firstDayOfYear.getTime()).toBe(new Date('2021-12-31T16:00:00.000Z').getTime());
        const SundayOfFirstWeek = offsetDate(offsetDate(firstDayOfYear).setDate(firstDayOfYear.getDate() - firstDayOfYear.getDay()));
        expect(_SundayOfFirstWeek.getTime()).toBe(new Date('2021-12-25T16:00:00.000Z').getTime());
        const W = Math.floor((date.getTime() - SundayOfFirstWeek.getTime()) / (7 * 24 * 60 * 60 * 1_000)) + 1;
        expect(W).toBe(48);
    });
});
