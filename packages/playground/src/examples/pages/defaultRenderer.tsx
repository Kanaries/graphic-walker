import Example from '../components/examplePage';
import code from './defaultRenderer.stories?raw';
import Comp from './defaultRenderer.stories';

export default function GraphicWalkerComponent() {
    return (
        <Example name="Default Renderer" code={code}>
            <Comp />
        </Example>
    );
}
