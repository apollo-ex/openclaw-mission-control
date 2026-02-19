# findings.md

- Node v25 includes built-in `node:sqlite`, which avoids native deps for SQLite MVP.
- OpenClaw CLI JSON output contracts are unknown; adapters are scaffolded with command-runner abstraction and resilient parsing.
- `openclaw gateway status` is known, but `openclaw sessions list --json` and `openclaw cron list --json` may differ from runtime reality; parser mapping will need a follow-up hardening pass with real command samples.
- Read-only boundary is enforced in adapter interfaces (no mutation methods exposed).
- Redaction should happen at ingest boundary before persistence; implemented for memory docs and event details in this pass.
- Vercel CLI can authenticate and create project links in this environment, but daemon-style services without a static output directory fail default deployment (`No Output Directory named "public" found`).
- GitHub CLI auth is available and supports repo creation/push under `apollo-ex`.
