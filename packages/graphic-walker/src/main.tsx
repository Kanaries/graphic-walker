import React from "react";
import ReactDOM from "react-dom";
import { GraphicWalker } from "./index";
import ResponsiveBox from "./responsiveBox";

import { inject } from "@vercel/analytics";
import "./index.css";

inject();

ReactDOM.render(
    <React.StrictMode>
        {process.env.NODE_ENV === 'development' && <ResponsiveBox />}
        {process.env.NODE_ENV !== 'development' && <GraphicWalker />}
    </React.StrictMode>,
    document.getElementById("root")
);
