import { formatDate } from '../../utils';
import { newOffsetDate } from './offset';

describe('getOffsetDate', () => {
    const offsetDate = newOffsetDate(-480);
    const offsetDate2 = newOffsetDate(-480);
    const utcOffsetDate = newOffsetDate(0);
    test('utc-parsed-fix', () => {
        const date = offsetDate('2023-11-20');
        expect(date.getFullYear()).toBe(2023);
        expect(date.getMonth()).toBe(10);
        expect(date.getDate()).toBe(20);
        expect(date.getHours()).toBe(0);
        expect(date.getMinutes()).toBe(0);
        expect(date.getSeconds()).toBe(0);
        const date2 = offsetDate2('2023-11-20');
        expect(date2.getFullYear()).toBe(2023);
        expect(date2.getMonth()).toBe(10);
        expect(date2.getDate()).toBe(20);
        expect(date2.getHours()).toBe(0);
        expect(date2.getMinutes()).toBe(0);
        expect(date2.getSeconds()).toBe(0);
        const utcDate = utcOffsetDate('2023-11-20');
        expect(utcDate.getFullYear()).toBe(2023);
        expect(utcDate.getMonth()).toBe(10);
        expect(utcDate.getDate()).toBe(20);
        expect(utcDate.getHours()).toBe(0);
        expect(utcDate.getMinutes()).toBe(0);
        expect(utcDate.getSeconds()).toBe(0);
    })
    test('no-timezone', () => {
        const date = offsetDate('2023-11-20 08:12:30');
        expect(date.getFullYear()).toBe(2023);
        expect(date.getMonth()).toBe(10);
        expect(date.getDate()).toBe(20);
        expect(date.getHours()).toBe(8);
        expect(date.getMinutes()).toBe(12);
        expect(date.getSeconds()).toBe(30);
        const utcDate = utcOffsetDate('2023-11-20 08:12:30');
        expect(utcDate.getFullYear()).toBe(2023);
        expect(utcDate.getMonth()).toBe(10);
        expect(utcDate.getDate()).toBe(20);
        expect(utcDate.getHours()).toBe(8);
        expect(utcDate.getMinutes()).toBe(12);
        expect(utcDate.getSeconds()).toBe(30);
        const date2 = offsetDate(utcDate);
        expect(date2.getFullYear()).toBe(2023);
        expect(date2.getMonth()).toBe(10);
        expect(date2.getDate()).toBe(20);
        expect(date2.getHours()).toBe(16);
        expect(date2.getMinutes()).toBe(12);
        expect(date2.getSeconds()).toBe(30);
    });
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
        expect(formatDate(date)).toBe('2023-11-20 15:35:11');
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

    test('timestamp zero', () => {
        const date = utcOffsetDate(0);
        expect(date).not.toBeNull();
        expect(date!.getTime()).toBe(0);
    });
});
