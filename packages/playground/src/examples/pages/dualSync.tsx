import Example from '../components/examplePage';
import code from './dualSync.stories?raw';
import Comp from './dualSync.stories';

export default function DualSyncPage() {
    return (
        <Example name="Dual GraphicWalker Sync" desc="Two GraphicWalker canvases mirror hover presence and VisSpec method calls in real time." code={code}>
            <Comp />
        </Example>
    );
}
