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
    width: 38,
    height: 38,
    padding: 0,
    backdropFilter: "blur(12px)",
    boxShadow: "0 14px 32px rgba(15, 23, 42, 0.14)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.08,
    transition: "opacity 160ms ease, transform 160ms ease, background-color 160ms ease",
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
    const [buttonHovered, setButtonHovered] = useState(false);
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

        function handleDocumentClick(event: MouseEvent) {
            const container = actionsRef.current;
            const eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
            const clickedInside = container ? eventPath.includes(container) || container.contains(event.target as Node | null) : false;
            if (!clickedInside) {
                setActionsOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setActionsOpen(false);
            }
        }

        window.addEventListener("click", handleDocumentClick);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("click", handleDocumentClick);
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

    const actionButtonStyle = {
        ...ACTION_BUTTON_STYLE,
        opacity: actionsOpen || buttonHovered ? 1 : ACTION_BUTTON_STYLE.opacity,
        background: actionsOpen || buttonHovered ? "rgba(255, 255, 255, 0.94)" : ACTION_BUTTON_STYLE.background,
        transform: actionsOpen || buttonHovered ? "translateY(-1px)" : "none",
    } satisfies React.CSSProperties;

    return (
        <div ref={actionsRef}>
            <button
                type="button"
                aria-label="Actions"
                aria-haspopup="menu"
                aria-expanded={actionsOpen}
                style={actionButtonStyle}
                onClick={() => setActionsOpen(value => !value)}
                onMouseEnter={() => setButtonHovered(true)}
                onMouseLeave={() => setButtonHovered(false)}
                onFocus={() => setButtonHovered(true)}
                onBlur={() => setButtonHovered(false)}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    style={{ width: 16, height: 16 }}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.867 19.125h.008v.008h-.008v-.008Z" />
                </svg>
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
