import Example from '../components/examplePage';
import code from './hideProfiling.stories?raw';
import Comp from './hideProfiling.stories';

export default function GraphicWalkerComponent() {
    return (
        <Example name="Hide Profiling" code={code}>
            <Comp />
        </Example>
    );
}
