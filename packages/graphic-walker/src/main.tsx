import React from "react";
import ReactDOM from "react-dom";
import { GraphicWalker } from "./index";

import { inject } from "@vercel/analytics";
import "./index.css";

inject();

ReactDOM.render(
    <React.StrictMode>
        <GraphicWalker themeKey="g2" dark="light" />
    </React.StrictMode>,
    document.getElementById("root")
);
