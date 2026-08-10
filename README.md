# ⚡ Taga

**منصة أتمتة سير عمل مدعومة بالذكاء الاصطناعي** — AI-powered no-code workflow automation platform (a Gumloop-style builder with full Arabic/RTL support).

Build automated workflows visually: drag nodes onto a canvas, connect them, and run them — manually, on a cron schedule, or via webhooks.

## Monorepo layout

| Package | Description |
| --- | --- |
| `packages/shared` | Shared TypeScript types + the built-in node catalog |
| `packages/engine` | DAG workflow executor: parallel execution, retries, conditional branches, per-node logs, graph validation |
| `apps/server` | Express API: JWT auth, workflows CRUD with automatic versioning, async runs, webhook triggers, cron scheduling (SQLite storage) |
| `apps/web` | React + Vite + React Flow visual editor with an Arabic RTL UI, node palette, config panel, live run logs, and a landing page |

## Built-in nodes

- **Inputs/Triggers**: Text input, Webhook trigger
- **AI**: LLM prompt (OpenAI-compatible), Summarize
- **Web**: HTTP request
- **Logic/Data**: Condition (if/else branching), sandboxed custom JS code, text template
- **Outputs**: Email (dev-logged), Log output

Adding a node = one definition in `packages/shared/src/catalog.ts` + one handler in `packages/engine/src/handlers.ts`.

## Getting started

```bash
npm install
npm run build

# terminal 1 — API on :4000
npm run dev:server

# terminal 2 — web app on :5173 (proxies /api to the server)
npm run dev:web
```

Open http://localhost:5173, create an account, and build your first flow.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default `4000`) |
| `TAGA_DB_PATH` | SQLite database path (default `taga.db`) |
| `TAGA_JWT_SECRET` | JWT signing secret (**required in production**) |
| `TAGA_LLM_API_KEY` | API key for AI nodes; without it, AI nodes return a deterministic dev echo |

### Webhook triggers

Set a workflow's trigger to **Webhook**, then:

```bash
curl -X POST http://localhost:4000/api/hooks/<workflow-id> -H 'Content-Type: application/json' -d '{"any":"payload"}'
```

### Tests

```bash
npm test
```

## Roadmap

- OAuth login (Google/GitHub), workspaces and roles
- Stripe billing with monthly credits
- More integrations (Gmail, Slack, Google Sheets, Notion, Telegram) with encrypted credentials
- AI flow builder from a natural-language description (Arabic/English)
- Template marketplace, live debugging, and realtime collaboration
