import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { ChartNoticeContent } from './route';

// What is shown where the translations are not loaded, as in a renderer mounted without the editor.
const english = {
    unsupported_title: 'This chart configuration is not supported yet',
    unsupported_desc: 'Adjust the fields or chart type to continue.',
    failed_title: 'The chart could not be drawn',
    failed_desc: 'Try again. Your chart settings are saved.',
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
            : notice.reason
            ? [notice.reason]
            : [];
    const detail = say(`${notice.state}_desc`);
    return (
        <div role="alert" data-testid="chart-notice" data-state={notice.state} className="flex w-full items-start p-6">
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
