import Example from '../components/examplePage';
import code from './teaserPie.stories?raw';
import Comp from './teaserPie.stories';

export default function TeaserPiePage() {
    return (
        <Example
            name="Pie: Car Sales by Manufacturer"
            desc="Top 8 passenger-car manufacturers by total sales volume."
            code={code}
        >
            <Comp />
        </Example>
    );
}
