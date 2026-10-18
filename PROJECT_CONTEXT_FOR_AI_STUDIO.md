# Focus — Project Context & Complete Architectural Manifest for Google AI Studio

This document provides a complete technical and structural overview of the **Focus** project so that Google AI Studio / Argon can immediately analyze, enhance, or completely redesign any visual, architectural, or experiential layers of the app.

---

## 1. Project Summary & Purpose
- **Project Name**: Focus (`focus-sanctuary`)
- **Core Concept**: A nature-inspired, storybook 2.5D personal productivity sanctuary and autonomous living village. Users input their daily goals; an AI-assisted or heuristic decomposition engine parses them into structured task sites; a deterministic DAG scheduler and A* pathfinder builds a feasible timeline and maps tasks to buildings in a persistent landscape.
- **Autonomous Village Economy**: The town lives on its own with functional economic nodes (Lumber Mill, Blacksmith Forge, Bakery Market, Town Watch, and Grand Keep) and animated citizen couriers (Garrick, Clara, Tormund, Captain Vance, Maya) transporting resources.
- **Diegetic First-Person Intro**: Starts in a cozy fire-lit timber sanctuary hall with 3D swinging oak doors, moving into a 3D cabin scene where villagers present a carved wooden chest where the user writes their goals.
- **Psychology-Grounded Replanning**: When plans change, the app recomputes feasible tasks for the remaining time without guilt or data loss, preserving completed buildings and explaining adjustments with plain-language diffs.

---

## 2. Tech Stack & Dependencies
- **Framework**: Next.js 14 (App Router, React 18, TypeScript 5)
- **State Management**: Zustand with versioned IndexedDB persistence (`idb`) and local storage
- **Styling**: Tailwind CSS, Lucide React icons
- **Audio & TTS**: `msedge-tts` (Microsoft Azure Multilingual Neural Voices: Ava, Emma, Andrew) + Web Audio API procedural soundscape engine (`soundscapeEngine.ts`) + optional ElevenLabs / AMD OmniVoice tiers
- **Validation**: Zod schemas (`taskSchemas.ts`, `aiSchemas.ts`, `worldSchemas.ts`)
- **Testing**: Vitest (`vitest run`) with 27 unit & end-to-end integration tests

---

## 3. Directory Map & File Manifest

### `src/app/` (Next.js App Router)
- `src/app/page.tsx`: Main single-page application orchestrating the diorama canvas, gateway, top bar, modals, and replan drawers.
- `src/app/layout.tsx`: HTML layout shell with font configurations.
- `src/app/globals.css`: Tailwind directives, custom scrollbars, and parchment themes.
- `src/app/api/ai/tts/route.ts`: Server-side neural voice endpoint (`msedge-tts` Azure flagship voices + ElevenLabs fallback).
- `src/app/api/ai/plan/route.ts`: Next.js API route generating structured task proposals from plain text goals.
- `src/app/api/ai/replan/route.ts`: API route for interruption replanning and schedule reallocation.
- `src/app/api/ai/models/route.ts`: Discovers AMD Token Factory model catalogue snapshots.

### `src/components/` (UI & Visual Diorama)
- `src/components/world/SanctuaryCanvas.tsx`: Interactive 2.5D Isometric Village Diorama & Autonomous Citizen Simulation (pan, zoom, animated walking villagers, SVG building illustrations with scaffolding/bloom, golden-hour shader).
- `src/components/world/LandmarkMesh.tsx`: Three.js / procedural building compound meshes (if 3D mode is toggled).
- `src/components/world/IslandTerrain.tsx`: Continuous 160×160 vertex-shaded valley terrain with river, bridge, and village square.
- `src/components/world/InstancedGrassAndFoliage.tsx`: 5,200+ instanced 3D grass blades, wildflowers, trees, and chimney smoke.
- `src/components/world/PathNetworkMesh.tsx`: Grounded 3D cobblestone road network and firefly waypoints.
- `src/components/world/VillagerAgents.tsx`: Animated 3D characters and grazing meadow sheep.
- `src/components/gateway/SanctuaryGateway.tsx`: First-person timber lodge intro with 3D swinging double oak gates and crackling hearth fire.
- `src/components/capture/GoalCaptureModal.tsx`: Full-screen 3D cabin scene with villagers holding the carved chest, diegetic parchment input, and custom hours/minutes selector.
- `src/components/capture/TaskProposalTray.tsx`: Optional detailed task proposal tray.
- `src/components/hud/TopSanctuaryBar.tsx`: Sharp storybook HUD displaying Town Level, Citizen Population, Village Gold, Timber, and spoken subtitles.
- `src/components/hud/ExperienceLabDrawer.tsx`: AMD Token Factory diagnostic inspector, model router, and cost telemetry.
- `src/components/hud/QuickGuideModal.tsx`: Skippable interactive sanctuary quick guide.
- `src/components/replan/ReplanDrawer.tsx`: Interruption replanning modal with custom remaining time, offline completion checkoffs, and villager voice reassurance.
- `src/components/replan/PlanDiffBanner.tsx`: High-contrast plan adjustment banner with undo capability.

### `src/core/` (Engines & Logic)
- `src/core/economy/villageEconomyEngine.ts`: Autonomous town economy simulation (Grand Keep, Sawmill, Forge, Bakery, Constable, and citizen agents).
- `src/core/audio/voiceoverEngine.ts`: Streams real neural audio from `/api/ai/tts` with blob caching and subtitle synchronization.
- `src/core/audio/soundscapeEngine.ts`: Web Audio API procedural sound synthesis (breeze, stream, chimes, celebration cues).
- `src/core/planner/scheduleEngine.ts`: Pure deterministic scheduling engine allocating intervals and adaptive transition buffers.
- `src/core/planner/replanEngine.ts`: Interruption replanner preserving completed tasks and prioritizing feasible active steps.
- `src/core/planner/dagValidator.ts`: Cycle detection and topological sorting via Kahn's algorithm.
- `src/core/planner/priorityScorer.ts`: Multi-factor task scoring heuristics.
- `src/core/pcg/worldGenerator.ts`: Procedural generation of terrain, landmark slots, and navigation graphs from seed.
- `src/core/pcg/terrainHeight.ts`: Continuous mathematical valley heightmap function `sampleValleyTerrainHeight(x, z)`.
- `src/core/pcg/prng.ts`: Mulberry32 seeded pseudo-random number generator.
- `src/core/pcg/noise2d.ts`: Simplex 2D noise implementation.
- `src/core/pathfinding/astar.ts`: A* pathfinding engine over the planar navigation graph.
- `src/core/textures/proceduralTextures.ts`: Offscreen canvas PBR albedo & bump map generator for stone, shingles, timber, and grass.
- `src/core/persistence/dbAdapter.ts`: Versioned IndexedDB snapshot storage adapter.
- `src/core/persistence/migrations.ts`: Schema migrations across storage versions.
- `src/core/ai/amdClient.ts`: Server-side AMD Token Factory gateway client.
- `src/core/ai/modelRouter.ts`: Multi-model fallback router (Gemma-4-31B -> DeepSeek -> Qwen).
- `src/core/ai/heuristicFallback.ts`: Instant deterministic semantic parser (sub-10ms fallback).
- `src/core/ai/jsonSanitizer.ts`: Robust markdown fence and `<think>` tag stripper.
- `src/core/ai/costCalculator.ts`: AMD token usage and unit economics calculator.

### `src/store/`
- `src/store/useFocusStore.ts`: Central Zustand store coordinating tasks, schedules, world models, audio, economy, and AI telemetry.

### `src/types/` & `src/schemas/`
- `src/types/task.ts`: Task items, priorities, schedule slots, plan diffs, snapshots.
- `src/types/world.ts`: Landmarks, biomes, world models, navigation nodes.
- `src/types/ai.ts`: AI proposals, telemetry, model catalogue types.
- `src/types/persistence.ts`: Storage schemas and migration contracts.
- `src/schemas/taskSchemas.ts`: Zod task validation schemas.
- `src/schemas/aiSchemas.ts`: Structured JSON contracts for LLM outputs.
- `src/schemas/worldSchemas.ts`: World profile and biome validation.

### `src/__tests__/` (Automated Test Suite)
- `src/__tests__/audio.test.ts`: Audio engine and voiceover tests.
- `src/__tests__/planner.test.ts`: Deterministic DAG scheduler & replanner tests.
- `src/__tests__/pathfinding.test.ts`: A* pathfinding correctness tests.
- `src/__tests__/pcg.test.ts`: Seeded world generation and boundary tests.
- `src/__tests__/aiSanitizer.test.ts`: Robust JSON sanitization tests.
- `src/__tests__/persistence.test.ts`: Storage migration and snapshot round-trip tests.
- `src/__tests__/integration.test.ts`: Complete end-to-end user lifecycle integration test.

---

## 4. How to Run the Project
```bash
npm install
npm test      # Runs all 27 Vitest unit & integration tests
npm run build # Compiles Next.js production build
npm run dev   # Starts local server on http://localhost:3000
```
