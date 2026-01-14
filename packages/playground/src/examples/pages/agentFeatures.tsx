import Example from '../components/examplePage';
import code from './agentFeatures.stories?raw';
import Comp from './agentFeatures.stories';

export default function AgentFeaturesPage() {
    return (
        <Example name="Agent Feature Playground" code={code}>
            <Comp />
        </Example>
    );
}
