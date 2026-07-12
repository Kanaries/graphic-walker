import Example from '../components/examplePage';
import code from './teaserScatter.stories?raw';
import Comp from './teaserScatter.stories';

export default function TeaserScatterPage() {
    return (
        <Example
            name="Scatter: Horsepower vs Price"
            desc="A scatter plot of car horsepower against price, colored by vehicle type and sized by engine displacement."
            code={code}
        >
            <Comp />
        </Example>
    );
}
