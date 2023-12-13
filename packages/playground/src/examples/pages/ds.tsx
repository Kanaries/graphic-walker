import Example from '../components/examplePage';
import code from './ds.stories?raw';
import Comp from './ds.stories';

export default function GraphicWalkerComponent() {
    return (
        <Example name="DataSource Segment" code={code}>
            <Comp />
        </Example>
    );
}
