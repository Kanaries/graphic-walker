import Example from '../components/examplePage';
import code from './pivotTable.stories?raw';
import Comp from './pivotTable.stories';

export default function PivotTableExample() {
    return (
        <Example name="PivotTable" code={code}>
            <Comp />
        </Example>
    );
}
