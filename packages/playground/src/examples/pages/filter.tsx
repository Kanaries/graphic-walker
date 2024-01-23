import Example from '../components/examplePage';
import code from './filter.stories?raw';
import Comp from './filter.stories';

export default function GraphicWalkerComponent() {
    return (
        <Example name="Filter Walker" code={code}>
            <Comp />
        </Example>
    );
}
