import Example from '../components/examplePage';
import code from './terseSpec.stories?raw';
import Comp from './terseSpec.stories';

export default function TerseSpecPage() {
    return (
        <Example
            name="TerseSpec (New Grammar)"
            desc="The hand-writable spec grammar: write a terse spec, normalize() expands it to the canonical chart spec."
            code={code}
        >
            <Comp />
        </Example>
    );
}
