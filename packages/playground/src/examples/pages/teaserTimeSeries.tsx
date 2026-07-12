import Example from '../components/examplePage';
import code from './teaserTimeSeries.stories?raw';
import Comp from './teaserTimeSeries.stories';

export default function TeaserTimeSeriesPage() {
    return (
        <Example
            name="Time Series: Bike Sharing"
            desc="Monthly bike sharing ridership trends, split by working day vs weekend/holiday."
            code={code}
        >
            <Comp />
        </Example>
    );
}
