import Example from '../components/examplePage';
import code from './exportChart.stories?raw';
import Comp from './exportChart.stories';

export default function ExportChartPage() {
    return (
        <Example name="Export Chart" code={code}>
            <Comp />
        </Example>
    );
}
