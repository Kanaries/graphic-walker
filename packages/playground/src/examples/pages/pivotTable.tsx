import Example from '../components/examplePage';
import code from './pivotTable.stories?raw';
import Comp from './pivotTable.stories';

export default function PivotTableExample() {
    return (
        <Example name="PivotTable" desc="Standalone PivotTable API with controlled collapse/expand interaction." code={code}>
            <Comp />
        </Example>
    );
}
