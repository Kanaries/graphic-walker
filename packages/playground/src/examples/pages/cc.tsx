import Example from '../components/examplePage';
import code from './cc.stories?raw';
import Comp from './cc.stories';

export default function GraphicWalkerComponent() {
    return (
        <Example name="Custom Color" code={code}>
            <Comp />
        </Example>
    );
}
