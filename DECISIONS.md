# Architecture Decision Records (ADRs) — Focus Sanctuary

## ADR-001: Hybrid AI + Deterministic Core Separation
- **Context:** Asking a language model to directly generate 3D coordinates, schedules, or raw shader code leads to overlapping meshes, broken dependency orderings, and non-reproducible worlds.
- **Decision:** Use AMD-hosted LLMs strictly for semantic decomposition (`Natural Language -> Proposed Tasks + Whitelisted WorldProfile Tokens + Interruption Constraints`). Delegate all scheduling (`computeDeterministicSchedule`), interruption replanning (`replanAfterInterruption`), spatial layout (`generateWorldModel`), and shortest-path routing (`findShortestPathAStar`) to deterministic, unit-tested TypeScript modules.
- **Consequence:** Every schedule is explainable, every world is 100% navigable, and the product remains useful even when hosted AI is offline or out of quota.

## ADR-002: Server-Only AMD Token Factory Gateway & Quota Protection
- **Context:** Shared endpoints on AMD Token Factory (`https://developer.amd.com.cn/radeon/api/v1`) enforce strict account rate and daily point quotas (`20 RPM`, observed `1 pt` daily cap).
- **Decision:**
  1. Isolate `AMD_TOKEN_FACTORY_API_KEY` inside Next.js server routes (`import 'server-only'`).
  2. Discover available models dynamically via `GET /models` with a 5-minute server cache.
  3. Route `Gemma-4-31B-IT` as Tier-1 Primary and `DeepSeek-V4.1-Flash` / `Qwen3.8-Flash-Next` as fallbacks.
  4. Strip `<think>...</think>` blocks and Markdown fences before strict Zod validation.
  5. Cache normalized prompt hashes in server memory so repeated tests consume 0 quota points, and halt retries immediately on HTTP `401/403` or account-wide `429`.

## ADR-003: JAHAN-Inspired Modular PCG with Isolated PRNG Streams
- **Context:** Completing a task should evolve that specific landmark (Stage 1 -> Stage 2 bloom) without causing the rest of the island or trees to randomly shift.
- **Decision:** Partition `cyrb128` + `mulberry32` pseudorandom streams into isolated channels (`terrain`, `landmarks`, `paths`, `decorations`) and validate output via automated assertions (`noLandmarkOverlap`, `graphConnected` via BFS, and `markerClearanceValid`). State updates use `applyTaskStateToWorldModel()`, which mutates growth stages and A* edge highlights while keeping coordinates 100% invariant.

## ADR-004: Web Audio API Procedural Soundscape Synthesis
- **Context:** External audio files add bundle weight and licensing complexity.
- **Decision:** Implement `SanctuarySoundscapeEngine` using native Web Audio API nodes initialized only after the user clicks `"Enter Your World"`.

## ADR-005: Exclusion of Evolus AI from Core v1 Build
- **Context:** "Evolus Business Agents on AMD" is a separate hackathon track focused on enterprise workflow automation and custom vLLM deployment.
- **Decision:** Keep Focus laser-focused on the **"Create a New Kind of Experience"** track. Park enterprise agent integrations in the optional post-hackathon roadmap.
