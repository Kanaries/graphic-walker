import React from "react";
import ReactDOM from "react-dom";
import { GraphicWalker } from "./index";

import { inject } from "@vercel/analytics";
import "./index.css";

if (!import.meta.env.DEV) {
    inject();
}

ReactDOM.render(
    <React.StrictMode>
        <GraphicWalker themeKey="g2" />
    </React.StrictMode>,
    document.getElementById("root")
);
