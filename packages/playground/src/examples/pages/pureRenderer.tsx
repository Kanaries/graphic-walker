import Example from "../components/examplePage";
import code from "./pureRenderer.stories?raw";
import Comp from "./pureRenderer.stories";

export default function PureRendererCompnent() {
  return (
    <Example name="Pure Renderer Example" code={code}>
      <Comp />
    </Example>
  );
}
