import { replaceFid, walkFid } from './sql';
import { IMutField } from '../interfaces';

describe('SQL Field Handling', () => {
    describe('replaceFid', () => {
        it('should handle Korean column names correctly', () => {
            const fields: IMutField[] = [
                {
                    fid: 'gwc_0',
                    name: '이름',
                    semanticType: 'nominal',
                    analyticType: 'dimension',
                },
                {
                    fid: 'gwc_1',
                    name: '나이',
                    semanticType: 'quantitative',
                    analyticType: 'measure',
                },
            ];

            // Test case-sensitive matching for Korean characters
            const sql1 = '이름';
            const result1 = replaceFid(sql1, fields);
            expect(result1).toBe('gwc_0');

            const sql2 = '나이 + 10';
            const result2 = replaceFid(sql2, fields);
            expect(result2).toContain('gwc_1');
        });

        it('should handle English column names with case-insensitive matching', () => {
            const fields: IMutField[] = [
                {
                    fid: 'gwc_0',
                    name: 'Name',
                    semanticType: 'nominal',
                    analyticType: 'dimension',
                },
                {
                    fid: 'gwc_1',
                    name: 'Age',
                    semanticType: 'quantitative',
                    analyticType: 'measure',
                },
            ];

            // Should match case-insensitively for ASCII
            const sql1 = 'name';
            const result1 = replaceFid(sql1, fields);
            expect(result1).toBe('gwc_0');

            const sql2 = 'AGE + 10';
            const result2 = replaceFid(sql2, fields);
            expect(result2).toContain('gwc_1');
        });

        it('should handle mixed Korean and English column names', () => {
            const fields: IMutField[] = [
                {
                    fid: 'gwc_0',
                    name: '고객이름',
                    semanticType: 'nominal',
                    analyticType: 'dimension',
                },
                {
                    fid: 'gwc_1',
                    name: 'CustomerAge',
                    semanticType: 'quantitative',
                    analyticType: 'measure',
                },
            ];

            const sql1 = '고객이름';
            const result1 = replaceFid(sql1, fields);
            expect(result1).toBe('gwc_0');

            const sql2 = 'customerage + 10';
            const result2 = replaceFid(sql2, fields);
            expect(result2).toContain('gwc_1');
        });

        it('should handle Chinese column names correctly', () => {
            const fields: IMutField[] = [
                {
                    fid: 'gwc_0',
                    name: '姓名',
                    semanticType: 'nominal',
                    analyticType: 'dimension',
                },
                {
                    fid: 'gwc_1',
                    name: '年龄',
                    semanticType: 'quantitative',
                    analyticType: 'measure',
                },
            ];

            const sql1 = '姓名';
            const result1 = replaceFid(sql1, fields);
            expect(result1).toBe('gwc_0');

            const sql2 = '年龄 * 2';
            const result2 = replaceFid(sql2, fields);
            expect(result2).toContain('gwc_1');
        });

        it('should handle Japanese column names correctly', () => {
            const fields: IMutField[] = [
                {
                    fid: 'gwc_0',
                    name: '名前',
                    semanticType: 'nominal',
                    analyticType: 'dimension',
                },
                {
                    fid: 'gwc_1',
                    name: '年齢',
                    semanticType: 'quantitative',
                    analyticType: 'measure',
                },
            ];

            const sql1 = '名前';
            const result1 = replaceFid(sql1, fields);
            expect(result1).toBe('gwc_0');

            const sql2 = '年齢 + 5';
            const result2 = replaceFid(sql2, fields);
            expect(result2).toContain('gwc_1');
        });
    });

    describe('walkFid', () => {
        it('should extract Korean field names from SQL', () => {
            const sql = '이름 + 나이';
            const result = walkFid(sql);
            expect(result).toContain('이름');
            expect(result).toContain('나이');
        });

        it('should extract Chinese field names from SQL', () => {
            const sql = '姓名 + 年龄';
            const result = walkFid(sql);
            expect(result).toContain('姓名');
            expect(result).toContain('年龄');
        });
    });
});
