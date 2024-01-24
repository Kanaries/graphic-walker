import Example from '../components/examplePage';
import code from './renderer.stories?raw';
import Comp from './renderer.stories';

export default function GraphicWalkerComponent() {
    return (
        <Example name="Filter Walker" code={code}>
            <Comp />
        </Example>
    );
}
