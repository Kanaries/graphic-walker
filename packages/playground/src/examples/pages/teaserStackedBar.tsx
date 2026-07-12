import Example from '../components/examplePage';
import code from './teaserStackedBar.stories?raw';
import Comp from './teaserStackedBar.stories';

export default function TeaserStackedBarPage() {
    return (
        <Example
            name="Stacked Bar: Titanic Survival"
            desc="Normalized stacked bar chart showing survival rate by passenger class on the Titanic."
            code={code}
        >
            <Comp />
        </Example>
    );
}
