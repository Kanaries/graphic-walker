import Example from "../components/examplePage";
import code from "./gw.stories?raw";
import Comp from "./gw.stories";

export default function GraphicWalkerComponent() {
  return (
    <Example name="Graphic Walker Example" code={code}>
      <Comp />
    </Example>
  );
}
