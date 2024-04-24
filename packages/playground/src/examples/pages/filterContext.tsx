import Example from '../components/examplePage';
import code from './filterContext.stories?raw';
import Comp from './filterContext.stories';

export default function GraphicWalkerComponent() {
    return (
        <Example name="FilterContext" code={code}>
            <Comp />
        </Example>
    );
}
