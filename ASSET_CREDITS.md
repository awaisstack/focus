# Asset Credits & Licensing Verification

Focus is engineered to be **100% self-contained and redistributable under the MIT License** without external copyrighted 3D models, textures, or audio recordings.

## 1. 2.5D 3D Geometry & Materials (`src/components/world/`)
- **Source:** 100% original procedural Three.js / React Three Fiber geometry assemblies authored in code (`IslandTerrain.tsx`, `LandmarkMesh.tsx`, `PathNetworkMesh.tsx`, `InstancedFlora.tsx`).
- **License:** MIT License (part of this repository).

## 2. Soundscape & Tactile Audio (`src/core/audio/soundscapeEngine.ts`)
- **Source:** 100% original real-time procedural synthesis built on the browser-standard **Web Audio API** (pink/brown noise buffers, LFO-modulated bandpass filters, and pentatonic sine/triangle oscillators). Zero external `.mp3`, `.wav`, or `.ogg` files are used.
- **License:** MIT License (part of this repository).

## 3. UI Icons (`lucide-react`)
- **Source:** [Lucide Icons](https://lucide.dev/) (`lucide-react` npm package).
- **License:** ISC License (permissive, MIT-compatible).

## 4. Typography (`tailwind.config.ts`)
- **Source:** Self-contained native OS serif (`Georgia` / `Cambria`), sans-serif (`system-ui` / `Segoe UI`), and monospace (`Consolas` / `SFMono-Regular`) font stacks—requiring zero runtime font CDN calls.
