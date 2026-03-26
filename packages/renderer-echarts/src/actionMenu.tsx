import React, { useEffect, useMemo, useRef, useState } from "react";

const ACTION_BUTTON_STYLE: React.CSSProperties = {
    position: "absolute",
    top: -18,
    right: -18,
    zIndex: 20,
    border: "1px solid rgba(15, 23, 42, 0.14)",
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.78)",
    color: "#0f172a",
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.02em",
    backdropFilter: "blur(12px)",
    boxShadow: "0 14px 32px rgba(15, 23, 42, 0.14)",
    cursor: "pointer",
};

const ACTION_MENU_STYLE: React.CSSProperties = {
    position: "absolute",
    top: 22,
    right: -18,
    zIndex: 21,
    minWidth: 220,
    padding: 8,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    borderRadius: 16,
    background: "rgba(255, 255, 255, 0.72)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 22px 48px rgba(15, 23, 42, 0.16)",
};

const ACTION_ITEM_STYLE: React.CSSProperties = {
    display: "block",
    width: "100%",
    border: "none",
    borderRadius: 12,
    background: "transparent",
    color: "#0f172a",
    padding: "10px 12px",
    textAlign: "left",
    fontSize: 13,
    cursor: "pointer",
};

function createOptionPreviewHtml(optionText: string) {
    const escaped = optionText.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ECharts Option</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        padding: 32px;
        background:
          radial-gradient(circle at top left, rgba(14, 116, 144, 0.14), transparent 32%),
          linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
        color: #0f172a;
        font-family: "SF Mono", "Monaco", "Cascadia Code", monospace;
      }
      main {
        max-width: 1080px;
        margin: 0 auto;
        padding: 24px;
        border: 1px solid rgba(15, 23, 42, 0.08);
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.84);
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
        backdrop-filter: blur(18px);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 24px;
      }
      p {
        margin: 0 0 16px;
        color: #475569;
        line-height: 1.6;
      }
      pre {
        margin: 0;
        padding: 18px;
        overflow: auto;
        border-radius: 18px;
        background: rgba(15, 23, 42, 0.92);
        color: #e2e8f0;
        font-size: 13px;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>ECharts Option</h1>
      <p>Generated from graphic-walker renderer-echarts.</p>
      <pre>${escaped}</pre>
    </main>
  </body>
</html>`;
}

function buildEditorUrl(optionText: string) {
    const editorSource = `option = ${optionText};\n`;
    return `https://echarts.apache.org/examples/en/editor.html?code=${btoa(editorSource)}&enc=base64`;
}

type EChartsActionMenuProps = {
    optionText: string;
};

export function EChartsActionMenu(props: EChartsActionMenuProps) {
    const actionsRef = useRef<HTMLDivElement | null>(null);
    const [actionsOpen, setActionsOpen] = useState(false);
    const editorUrl = useMemo(() => {
        try {
            return buildEditorUrl(props.optionText);
        } catch (error) {
            console.warn("[graphic-walker] Failed to compress editor source for ECharts editor.", error);
            return "https://echarts.apache.org/examples/en/editor.html";
        }
    }, [props.optionText]);

    useEffect(() => {
        if (!actionsOpen) {
            return;
        }

        function handlePointerDown(event: MouseEvent) {
            if (!actionsRef.current?.contains(event.target as Node)) {
                setActionsOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setActionsOpen(false);
            }
        }

        window.addEventListener("mousedown", handlePointerDown);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("mousedown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [actionsOpen]);

    function openOptionPreview() {
        const previewUrl = URL.createObjectURL(new Blob([createOptionPreviewHtml(props.optionText)], { type: "text/html" }));
        window.open(previewUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
        setActionsOpen(false);
    }

    function openEditor() {
        window.open(editorUrl, "_blank", "noopener,noreferrer");
        setActionsOpen(false);
    }

    return (
        <div ref={actionsRef}>
            <button type="button" aria-haspopup="menu" aria-expanded={actionsOpen} style={ACTION_BUTTON_STYLE} onClick={() => setActionsOpen(value => !value)}>
                Actions
            </button>
            {actionsOpen ? (
                <div role="menu" aria-label="ECharts actions" style={ACTION_MENU_STYLE}>
                    <button type="button" role="menuitem" style={ACTION_ITEM_STYLE} onClick={openOptionPreview}>
                        Open option JSON
                    </button>
                    <button type="button" role="menuitem" style={ACTION_ITEM_STYLE} onClick={openEditor}>
                        Open in ECharts editor
                    </button>
                </div>
            ) : null}
        </div>
    );
}
