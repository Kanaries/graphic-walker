import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DomEvent } from 'leaflet';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import type { GeoDataErrorCode } from '../../lib/geo/parse';
import { GEO_NOTICE_ENGLISH as english } from './geoNoticeText';

type Key = keyof typeof english;

export function useGeoNoticeText() {
    const { t } = useTranslation('translation', { keyPrefix: 'geo_notice' });
    return (key: Key, values?: Record<string, string | number>) => t(key, { defaultValue: english[key], ...values });
}

/** The sentence for a geographic data error, in the user's language. */
export function useGeoErrorText() {
    const say = useGeoNoticeText();
    return (error: { code: GeoDataErrorCode; detail: string }) => say(`error_${error.code}`, { detail: error.detail });
}

export type GeoNoticeContent =
    | { state: 'no_data' | 'no_field' }
    | { state: 'bad_key'; key: string }
    | {
          /** What matching the data to the shapes left to report. */
          state: 'match';
          key: string;
          /** Distinct values that found a shape, and distinct values in all. */
          matched: number;
          total: number;
          unmatchedValues: string[];
          featureSamples: string[];
          emptyRows: number;
          /** Groups of differently written values that found the same shape. */
          sharedValues: string[][];
          /** Values whose shape has no geometry. */
          undrawnValues: string[];
      };

const VALUE_LIMIT = 5;
const GROUP_LIMIT = 3;

/**
 * Says, on the map, why some or all of the data is not drawn. It sits in a corner and can be
 * dismissed. It comes back when what it reports changes.
 */
export function GeoNotice({ notice }: { notice: GeoNoticeContent }) {
    const say = useGeoNoticeText();
    const box = useRef<HTMLDivElement>(null);
    const signature = JSON.stringify(notice);
    const [dismissed, setDismissed] = useState('');

    useEffect(() => {
        // Clicks and scrolls on the notice are not meant for the map under it.
        if (box.current) {
            DomEvent.disableClickPropagation(box.current);
            DomEvent.disableScrollPropagation(box.current);
        }
    });

    if (dismissed === signature) return null;

    /** The first few of a list, with a count of the rest. */
    const some = (items: string[], limit: number, separator = ', ') => {
        const shown = items.slice(0, limit).join(separator);
        return items.length > limit ? say('unmatched_more', { values: shown, count: items.length - limit }) : shown;
    };

    let kind: string = notice.state;
    let title: string;
    const lines: string[] = [];
    if (notice.state === 'match') {
        // Each thing to report has a title and a line that reads on its own. The first one gives
        // the notice its title. The others follow as lines.
        const issues: { kind: string; title: string; line?: string }[] = [];
        if (notice.unmatchedValues.length > 0) {
            issues.push({
                kind: 'unmatched',
                title: say('unmatched_title', { matched: notice.matched, total: notice.total }),
                line: say('unmatched_values', { values: some(notice.unmatchedValues, VALUE_LIMIT) }),
            });
        }
        if (notice.sharedValues.length > 0) {
            const groups = notice.sharedValues.map((group) => some(group, VALUE_LIMIT, ' / '));
            issues.push({ kind: 'shared', title: say('shared_title'), line: say('shared_values', { values: some(groups, GROUP_LIMIT, '; ') }) });
        }
        if (notice.undrawnValues.length > 0) {
            issues.push({
                kind: 'no_geometry',
                title: say('no_geometry_title'),
                line: say('no_geometry_values', { values: some(notice.undrawnValues, VALUE_LIMIT) }),
            });
        }
        if (notice.emptyRows > 0) issues.push({ kind: 'empty_rows', title: say('empty_rows', { count: notice.emptyRows }) });
        if (issues.length === 0) return null;

        kind = issues[0].kind;
        title = issues[0].title;
        if (issues[0].line) lines.push(issues[0].line);
        for (const issue of issues.slice(1)) lines.push(issue.line ?? issue.title);
        if (notice.unmatchedValues.length > 0 && notice.featureSamples.length > 0) {
            lines.push(say('unmatched_key', { key: notice.key, samples: notice.featureSamples.join(', ') }));
        }
    } else if (notice.state === 'bad_key') {
        title = say('bad_key_title', { key: notice.key });
        lines.push(say('bad_key_desc'));
    } else {
        title = say(`${notice.state}_title`);
        lines.push(say(`${notice.state}_desc`));
    }

    return (
        <div
            ref={box}
            role="status"
            data-testid="geo-notice"
            data-state={kind}
            className="absolute bottom-3 left-3 max-w-sm cursor-default rounded-md border bg-popover p-3 pr-8 text-xs text-popover-foreground shadow-md"
            style={{ zIndex: 999 }}
        >
            <p className="font-medium" data-testid="geo-notice-title">
                {title}
            </p>
            {lines.map((line) => (
                <p key={line} className="mt-1 break-words text-muted-foreground" data-testid="geo-notice-line">
                    {line}
                </p>
            ))}
            <Button
                size="icon-xs"
                variant="ghost"
                className="absolute right-2 top-2"
                aria-label={say('dismiss')}
                title={say('dismiss')}
                data-testid="geo-notice-dismiss"
                onClick={() => setDismissed(signature)}
            >
                <XMarkIcon className="h-4 w-4" />
            </Button>
        </div>
    );
}

/** Fills the chart area when the shapes behind a URL could not be loaded. */
export function GeoLoadFailed({ error, onRetry }: { error: { code: GeoDataErrorCode; detail: string }; onRetry?: () => void }) {
    const say = useGeoNoticeText();
    const reason = useGeoErrorText()(error);
    const canRetry = onRetry && (error.code === 'network' || error.code === 'http');
    return (
        <div role="alert" data-testid="geo-load-failed" data-code={error.code} className="flex h-full w-full items-start p-6">
            <div className="max-w-xl space-y-2 text-sm">
                <p className="font-medium text-foreground">{say('load_failed_title')}</p>
                <p className="text-foreground" data-testid="geo-load-failed-reason">
                    {reason}
                </p>
                {canRetry && (
                    <Button size="sm" variant="outline" onClick={onRetry} data-testid="geo-load-failed-retry">
                        {say('retry')}
                    </Button>
                )}
            </div>
        </div>
    );
}
