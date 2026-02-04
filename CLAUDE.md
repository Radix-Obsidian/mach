# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dot** is a personal AI assistant platform (Node.js ≥22, TypeScript ESM) that unifies messaging across 10+ built-in channels (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) and 20+ extension channels. It includes a Gateway server, CLI, native apps (macOS/iOS/Android), and MACH (Mission-driven AI Command Hub) for agent-based mission processing via Supabase.

## Build, Test, and Lint Commands

```bash
pnpm install                  # Install dependencies (pnpm 10.23.0)
pnpm build                    # TypeScript compile + bundle frontend
pnpm check                    # Full pipeline: type-check + Oxlint + Oxfmt
pnpm lint                     # Oxlint only (type-aware)
pnpm format                   # Oxfmt only
pnpm test                     # Vitest (unit + integration)
pnpm test:coverage            # With V8 coverage (70% threshold)
pnpm test:e2e                 # End-to-end tests
pnpm test:live                # Live tests (needs CLAWDBOT_LIVE_TEST=1 or LIVE=1)
pnpm mach:dev                 # MACH frontend + backend concurrently
pnpm mach:backend:dev         # MACH Express server (tsx)
pnpm mach:frontend:dev        # MACH React dashboard (Vite)
prek install                  # Install pre-commit hooks
```

Run a single test file: `pnpm vitest run src/path/to/file.test.ts`

Before pushing: `pnpm build && pnpm check && pnpm test`

## Architecture

### Entry Points & CLI
- **`dot.mjs`** → **`src/entry.ts`** → **`src/index.ts`**: CLI bootstrap via Commander.js
- CLI wiring: `src/cli/`, commands: `src/commands/` (agent, send, config, channels, gateway, wizard, etc.)
- Dependency injection pattern: `createDefaultDeps`

### Gateway (`src/gateway/`)
Express server (port 18789) — the control plane for channel management, RPC, real-time agent processing, and the embedded Lit.js control UI (`ui/`).

### MACH System (`src/mach/`)
- **`server.ts`**: Express server with webhook + polling modes for mission processing
- **`worker.ts`**: Spawns `runEmbeddedPiAgent()` for each mission
- **`routes/`**: Webhook handler (Supabase INSERT events with HMAC verification), health checks
- **`frontend/`**: Separate React app (Vite + Shadcn/ui + Supabase real-time) served from `static/`
- **Mission flow**: Frontend/webhook → INSERT → `processMission()` → Pi agent → result stored in Supabase `missions` table

### Channel System
- **Built-in**: `src/telegram`, `src/discord`, `src/slack`, `src/signal`, `src/imessage`, `src/web`, `src/line`, `src/channels`, `src/routing`
- **Extensions** (workspace packages): `extensions/*` (msteams, matrix, zalo, voice-call, etc.)
- When refactoring shared logic (routing, allowlists, pairing, onboarding), consider **all** channels

### Agent System (`src/agents/`)
Pi-based embedded agents with workspace/session management. Supports Anthropic (Claude), OpenAI, AWS Bedrock providers (`src/providers/`).

### Configuration (`src/config/`)
JSON5 format, Zod-validated schema, stored at `~/.dot/`. Type definitions: `types.ts`, `types.openclaw.ts`, schema: `schema.ts`.

### Plugin System
- Plugin SDK: `src/plugin-sdk/`, extensions: `extensions/*` (pnpm workspace packages)
- Plugin deps go in the extension's own `package.json`, not root
- Avoid `workspace:*` in `dependencies`; use `devDependencies` or `peerDependencies` for `dot`

## Coding Conventions

- **TypeScript ESM**, strict mode, no `any`. Target: ES2023, module: NodeNext.
- **Formatting/linting**: Oxlint + Oxfmt (Rust-based). Run `pnpm check` before commits.
- Keep files under ~500-700 LOC; split/refactor for clarity.
- Tests colocated as `*.test.ts`; e2e as `*.e2e.test.ts`; live as `*.live.test.ts`.
- CLI progress: use `src/cli/progress.ts` (osc-progress + @clack/prompts spinner).
- Status tables: `src/terminal/table.ts`; colors via `src/terminal/palette.ts` (no hardcoded colors).
- Tool schemas: avoid `Type.Union`/`anyOf`/`oneOf`/`allOf`; use `stringEnum`/`optionalStringEnum` for string lists. Avoid raw `format` property names.

## Commit & PR Workflow

- Create commits with `scripts/committer "<msg>" <file...>` (keeps staging scoped).
- Concise, action-oriented messages (e.g. `CLI: add verbose flag to send`).
- PR gate: `pnpm build && pnpm check && pnpm test` locally before merge.
- Prefer **rebase** for clean history, **squash** for messy history.
- When merging contributor PRs: add co-contributor credit, changelog entry with PR # + thanks, run `bun scripts/update-clawtributors.ts`.
- Changelog: latest released version at top (no `Unreleased` section).

## Key Constraints

- Any dependency with `pnpm.patchedDependencies` must use exact version (no `^`/`~`).
- Patching dependencies (pnpm patches, overrides, vendored changes) requires explicit approval.
- Never update the Carbon dependency.
- Never commit real phone numbers, videos, or live config values.
- Never send streaming/partial replies to external messaging channels (WhatsApp, Telegram, etc.); only final replies.
- Version locations: `package.json`, `apps/android/app/build.gradle.kts`, `apps/ios/Sources/Info.plist`, `apps/macos/Sources/dot/Resources/Info.plist`, `docs/install/updating.md`, `docs/platforms/mac/release.md`.
- Do not rebuild macOS app over SSH.
- SwiftUI: prefer `Observation` framework (`@Observable`) over `ObservableObject`/`@StateObject`.

## Multi-Agent Safety

- Do **not** create/apply/drop `git stash` entries unless explicitly requested.
- Do **not** create/remove/modify `git worktree` checkouts unless explicitly requested.
- Do **not** switch branches unless explicitly requested.
- When committing, scope to your changes only. When user says "commit all", commit in grouped chunks.
- Unrecognized files: ignore them, focus on your changes.

## Docs (Mintlify)

- Hosted at docs.dot.ai. Internal links: root-relative, no `.md`/`.mdx` extension (e.g. `[Config](/configuration)`).
- README uses absolute `https://docs.dot.ai/...` URLs.
- No personal device names/hostnames in docs; use generic placeholders.
