import React from "react";
import ReactDOM from "react-dom";
import { GraphicWalker } from "./index";

import { inject } from "@vercel/analytics";
import "./index.css";

inject();

ReactDOM.render(
    <React.StrictMode>
        <GraphicWalker fixContainer />
    </React.StrictMode>,
    document.getElementById("root")
);
