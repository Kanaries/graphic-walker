import Example from '../components/examplePage';
import code from './table.stories?raw';
import Comp from './table.stories';

export default function GraphicWalkerComponent() {
    return (
        <Example name="TableWalker" code={code}>
            <Comp />
        </Example>
    );
}
