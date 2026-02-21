# findings.md

- Node v25 includes built-in `node:sqlite`, which avoids native deps for SQLite MVP.
- OpenClaw CLI JSON output contracts are unknown; adapters are scaffolded with command-runner abstraction and resilient parsing.
- `openclaw gateway status` is known, but `openclaw sessions list --json` and `openclaw cron list --json` may differ from runtime reality; parser mapping will need a follow-up hardening pass with real command samples.
- Read-only boundary is enforced in adapter interfaces (no mutation methods exposed).
- Redaction should happen at ingest boundary before persistence; implemented for memory docs and event details in this pass.
- Vercel CLI can authenticate and create project links in this environment, but daemon-style services without a static output directory fail default deployment (`No Output Directory named "public" found`).
- GitHub CLI auth is available and supports repo creation/push under `apollo-ex`.
- UI audit (2026-02-20) confirms the main page currently mixes too many concepts on one surface (runtime lanes + load map + cron + health + stream + memory), which increases cognitive load and makes active/inactive status hard to interpret quickly.
- The current `RuntimeLane` component sorts and slices sessions but still shows mixed run types/statuses in one list; this is useful for detail but poor for at-a-glance operator understanding.
- Mobile audit confirms density remains high: too many panels compete vertically, and users must context-switch between unrelated widgets.
- Better information architecture should be: (1) graph first for topology flow, (2) focused detail drawer/panel second, (3) event stream third.
- React Flow is a good fit for this use case because it provides node/edge graphing, pan/zoom, and custom node renderers while preserving React state and can be kept read-only.
- Practical React Flow package choice: `@xyflow/react` (formerly reactflow). Recommended to lazy-load graph rendering and keep a non-graph fallback for very small/mobile viewports.
