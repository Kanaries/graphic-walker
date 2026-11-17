import { GEO_NOTICE_ENGLISH } from './geoNoticeText';
import en from '../../locales/en-US.json';
import zh from '../../locales/zh-CN.json';
import ja from '../../locales/ja-JP.json';

const locales: Record<string, any> = { 'en-US': en, 'zh-CN': zh, 'ja-JP': ja };
const placeholders = (text: string) => [...text.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();
// The keys the geography settings dialog asks for on top of the ones it had before.
const settingsKeys = ['selectData', 'manual', 'geoData', 'geoKeyEmpty', 'geoKeySample', 'noSource'];

describe.each(Object.keys(locales))('map messages in %s', (name) => {
    const notice: Record<string, string> = locales[name].geo_notice;
    const settings: Record<string, string> = locales[name].main.tabpanel.settings.geography_settings;

    it('has every message the map can show, and no others', () => {
        expect(Object.keys(notice).sort()).toEqual(Object.keys(GEO_NOTICE_ENGLISH).sort());
    });

    it('fills in the same values as the built-in English text', () => {
        for (const [key, text] of Object.entries(GEO_NOTICE_ENGLISH)) {
            expect([key, placeholders(notice[key])]).toEqual([key, placeholders(text)]);
        }
    });

    it('has the text of the geography settings dialog', () => {
        for (const key of settingsKeys) {
            expect([key, typeof settings[key]]).toEqual([key, 'string']);
        }
        expect(placeholders(settings.geoKeySample)).toEqual(['samples']);
    });
});

it('ships the same English text in the locale file as in the code', () => {
    expect(en.geo_notice).toEqual(GEO_NOTICE_ENGLISH);
});
