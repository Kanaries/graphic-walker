import Example from '../components/examplePage';
import code from './tableSettings.stories?raw';
import Comp from './tableSettings.stories';

export default function TableSettingsPage() {
    return (
        <Example name="TableWalker Settings" code={code}>
            <Comp />
        </Example>
    );
} 