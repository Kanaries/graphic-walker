import Example from '../components/examplePage';
import code from './vlSpec.stories?raw';
import Comp from './vlSpec.stories';

export default function TableSettingsPage() {
    return (
        <Example name="VlSpec" code={code}>
            <Comp />
        </Example>
    );
} 