# MCP Dashboard Playground

This package hosts a small dashboard that demonstrates how a React UI, an Express server, WebSockets, and an MCP server can keep a shared state in sync. When the server starts it opens the dashboard in your browser, and the MCP endpoint exposes the same state to agents.

## Features

- **Vite + React UI** – live view of the dashboard state plus controls to stage partial updates.
- **Express backend** – serves the UI, exposes REST helpers, and brokers WebSocket traffic.
- **WebSocket bridge** – pushes state updates from the server to the browser and vice versa.
- **MCP server** – exposes `state://current`, `state://docs`, and the `update-dashboard-state` tool over the Streamable HTTP transport.
- **Auto-shutdown** – when the dashboard tab closes and the WebSocket disconnects, the entire server tears down.

## Scripts

```bash
# from the repo root
yarn install

# start the dashboard in dev mode (Vite middleware + Express + MCP)
yarn workspace @kanaries/mcp-dashboard dev

# build static assets for production
yarn workspace @kanaries/mcp-dashboard build

# run the production server (serves the built assets)
yarn workspace @kanaries/mcp-dashboard start
```

By default the server listens on `http://127.0.0.1:4399` and automatically opens your browser. Use `MCP_DASHBOARD_PORT` or `MCP_DASHBOARD_HOST` to override the defaults.

## HTTP + WebSocket API

- `GET /api/state` – fetch the current dashboard state.
- `PATCH /api/state` – apply `{ mood?, counter?, note? }` (all optional, at least one required).
- `GET /api/docs` – markdown instructions mirrored to MCP agents.
- `GET /ws` (WebSocket) – bi-directional channel using `{ type: 'state' }` & `{ type: 'log' }` server events and `{ type: 'update' | 'ping' }` client events.

## MCP surface area

Transport endpoint: `POST/GET /mcp` using Streamable HTTP (SSE + JSON).

Registered resources:

| Name | URI | Description |
| --- | --- | --- |
| `dashboard-state` | `state://current` | JSON snapshot of the live state. |
| `dashboard-docs` | `state://docs` | Markdown usage instructions for agents. |

Registered tool:

| Tool | Description | Input schema |
| --- | --- | --- |
| `update-dashboard-state` | Patch any subset of `{ mood, note, counter }`. | `mood`: string (≤64 chars), `note`: string (≤5000 chars), `counter`: integer 0–999. |

## Auto-shutdown behavior

When the only browser tab disconnects from the `/ws` endpoint, the server waits 500 ms and then:

1. Broadcasts a closing frame to remaining sockets (if any),
2. Closes the MCP server transport,
3. Stops the HTTP server and exits the process.

Open a new dashboard tab to keep the node process alive.
