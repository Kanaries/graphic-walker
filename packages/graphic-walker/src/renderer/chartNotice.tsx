import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { ChartNoticeContent } from './route';

// What is shown where the translations are not loaded, as in a renderer mounted without the editor.
const english = {
    loading_title: 'Loading the worksheet renderer…',
    unavailable_title: 'The worksheet renderer is not available here',
    unavailable_desc:
        'This chart is set to be drawn by the worksheet renderer, a preview that this environment does not include. The chart is kept as it is, and no other renderer draws it in its place. Open it where the worksheet renderer is available, or choose another renderer in the chart settings.',
    unsupported_title: 'The worksheet renderer cannot draw this chart yet',
    unsupported_desc: 'The chart is kept as it is. Change what the message names, or choose another renderer in the chart settings.',
    failed_title: 'The chart could not be drawn',
    failed_desc: 'The chart and its renderer are kept as they are. Try again, or change the chart.',
    retry: 'Try again',
    levels_title: '{{renderer}} cannot show every level of this chart',
    levels_reason: '{{shelf}} holds {{count}} dimensions ({{fields}}). {{renderer}} shows two at most.',
    levels_desc:
        'Drawing it would leave levels out, so nothing is drawn. The chart is kept as it is. Take dimensions off the shelf, or choose a renderer that nests them in the chart settings.',
    shelf_rows: 'Rows',
    shelf_columns: 'Columns',
};
const rendererNames = { 'vega-lite': 'VegaLite', 'observable-plot': 'Observable Plot' };

/**
 * Stands in the chart area for a chart that is not drawn, and says why. The chart and its
 * renderer setting are untouched; nothing else is drawn in its place.
 */
export default function ChartNotice({ notice, onRetry }: { notice: ChartNoticeContent; onRetry?: () => void }) {
    const { t } = useTranslation('translation', { keyPrefix: 'chart_notice' });
    const say = (key: keyof typeof english, values?: Record<string, string | number>) => t(key, { defaultValue: english[key], ...values });
    const renderer = notice.state === 'levels' ? rendererNames[notice.renderer] : '';
    const title = notice.state === 'levels' ? say('levels_title', { renderer }) : say(`${notice.state}_title`);
    const reasons =
        notice.state === 'levels'
            ? notice.shelves.map((held) => say('levels_reason', { shelf: say(`shelf_${held.shelf}`), count: held.fields.length, fields: held.fields.join(', '), renderer }))
            : 'reason' in notice
            ? [notice.reason]
            : [];
    const detail = notice.state === 'loading' ? '' : say(`${notice.state}_desc`);
    return (
        <div role={notice.state === 'loading' ? 'status' : 'alert'} data-testid="chart-notice" data-state={notice.state} className="flex w-full items-start p-6">
            <div className="max-w-xl space-y-2 text-sm">
                <p className="font-medium text-foreground">{title}</p>
                {reasons.map((reason) => (
                    <p key={reason} className="text-foreground" data-testid="chart-notice-reason">
                        {reason}
                    </p>
                ))}
                {detail && <p className="text-muted-foreground">{detail}</p>}
                {notice.state === 'failed' && onRetry && (
                    <Button size="sm" variant="outline" onClick={onRetry} data-testid="chart-notice-retry">
                        {say('retry')}
                    </Button>
                )}
            </div>
        </div>
    );
}
