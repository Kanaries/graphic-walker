import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

const container = document.getElementById("root");

if (!container) {
    throw new Error("Failed to find root element");
}

createRoot(container).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
