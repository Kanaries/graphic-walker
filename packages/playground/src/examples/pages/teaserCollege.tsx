import Example from '../components/examplePage';
import code from './teaserCollege.stories?raw';
import Comp from './teaserCollege.stories';

export default function TeaserCollegePage() {
    return (
        <Example
            name="Scatter: College Cost vs Earnings"
            desc="Cost of attendance versus median earnings after graduation, colored by funding model and sized by admission rate."
            code={code}
        >
            <Comp />
        </Example>
    );
}
