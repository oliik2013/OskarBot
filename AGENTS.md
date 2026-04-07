# AGENTS.md

## Commands
- Install deps with `pnpm install`.
- Run the bot in watch mode with `pnpm dev`. This uses `chokidar-cli` to rerun `pnpm tsx src/main.ts` when files under `src/commands`, `src/events`, or root `src/*.ts` change.
- Register Discord commands manually with `pnpm tsx src/register.ts`.
- There are no checked-in `test`, `build`, `lint`, or `typecheck` scripts in `package.json`. Do not assume they exist.

## Entrypoints
- `src/main.ts` is the runtime entrypoint. It loads every command from `src/commands/<group>/*` and every event from `src/events/*` via dynamic ESM imports.
- `src/register.ts` is a separate command-registration script; use it when command definitions change.
- Commands must default-export an object with `data`, `execute`, and `autocomplete` to be picked up by the runtime loader.
- Events default-export an object with `eventType` and `execute`.

## TypeScript / Module Quirks
- This repo is native ESM (`"type": "module"`) on `NodeNext` with `allowImportingTsExtensions`; local imports use explicit `.ts` extensions. Preserve that pattern or imports will fail.
- `tsconfig.json` defines a `~/* -> ./src/*` path alias, but the current code mostly uses relative imports.

## Environment
- Required env vars verified in code and `.env.example`: `BOT_CLIENT_ID`, `BOT_TOKEN`, `GROQ_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `OWNER_ID`, `BOT_GUILD_ID`.
- `BOT_GUILD_ID` is only used by `src/register.ts`; the main bot process logs in without it.

## Behavior That Docs Miss
- The README is stale in at least two important places:
- Message rate limiting in `src/utils/redis.ts` is `15` requests per `5 h`, not `25`.
- The startup purr loop is currently disabled in `src/main.ts`.

## Persistence / State
- Redis is the only verified persistent store in active use. It backs message limits, blacklists, and giveaways.
- Giveaway state is stored under Redis keys in `src/utils/giveaway.ts` and restored on startup via `recoverGiveaways(client)` in `src/main.ts`.
- `package.json` includes `drizzle` / `libsql` packages and `db:*` scripts, but no checked-in drizzle config or active runtime usage was found. Treat the DB setup as incomplete/stale until verified before changing it.

## Audio / Assets
- Voice playback expects local files under `assets/playlist` and resolves audio paths relative to either `process.cwd()` or the repo root helpers in `src/utils/voice.ts`.
- The mention-response flow in `src/events/message.ts` can fetch an external image from `https://morrisapi.starnumber12046.workers.dev/oskar` when the model returns `{{MYSELF}}`.

## Operational Gotcha
- `src/register.ts` currently pushes both guild and global commands, then fetches guild commands and deletes them. Read that file carefully before using it for command rollout changes.
