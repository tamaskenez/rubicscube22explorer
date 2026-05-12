# Technology survey

## 1. What needs to be built

The app has three largely independent technical concerns:

- **3D rendering** of one or more cubes, with pointer-driven camera rotation
- **UI widgets** (buttons, dropdowns, color palette, arrows-with-labels between cubes)
- **Solver** (pure computation, runs whenever the active configuration changes)

The choices for each are mostly orthogonal, so this survey first describes each axis, then proposes concrete stacks that combine them.

## 2. Primer on the web platform

Every modern web browser natively runs three things:

- **HTML** — the document structure (tags like `<div>`, `<button>`).
- **CSS** — styling and layout. CSS also supports basic 3D transforms (rotate/translate elements in 3D space), enough to build a cube without any 3D library.
- **JavaScript (JS)** — the scripting language. **TypeScript (TS)** is JS with a type system layered on top; it compiles to JS. TS is widely used for non-trivial apps because the types catch many mistakes early.

Browsers additionally expose:

- **WebGL** — a low-level 3D graphics API based on OpenGL ES. Verbose to use directly; usually accessed via a library like Three.js.
- **WebGPU** — newer, more modern replacement for WebGL. Better API but still relatively new (Chrome and Edge ship it; Safari and Firefox support is partial as of 2026).
- **WebAssembly (wasm)** — a binary format that lets you compile other languages (Rust, C++, Go, C#, …) to a format the browser runs at near-native speed. Wasm code can call into JS and vice versa.
- **Web Workers** — background threads. JS itself is single-threaded; a worker lets long-running computations (e.g. the solver) run without freezing the UI. Built into the browser, no dependency needed.

**Tooling note.** Anything beyond a single `index.html` with inline scripts usually involves:

- A **package manager** (npm, pnpm, or yarn) to install JS dependencies into a `node_modules/` folder. They are all interchangeable; npm ships with Node.js.
- A **bundler / dev server**. The most popular today is **Vite** — it serves your code with hot-reload during development and bundles it into a few static files for deployment. Adds one dev-time dependency.
- For wasm options, you additionally need the toolchain of the source language (Rust + `cargo` + `wasm-bindgen`, or Emscripten for C++, or the Godot editor, etc.).

**Debugging.** Every browser ships DevTools (Cmd+Opt+I on macOS). DevTools give a JS debugger with breakpoints, a DOM inspector, a network panel, and a console. JS and TS debug well out of the box (TS via source maps, automatic with Vite). Wasm code is harder to debug — Chrome can step through Rust/C++ source with DWARF debug info, but the experience is rougher; `console.log`-style debugging from wasm is straightforward but less interactive.

## 3. Axis A — 3D rendering

### A1. CSS 3D transforms (no 3D library)

A 2x2 cube is small enough that the 24 colored facelets can each be a plain HTML element (`<div>`) positioned in 3D using CSS transforms. The browser composites them. No WebGL, no library.

- **Conciseness:** Cube geometry ~50 lines. Face rotations are CSS transitions (~1 line each). Drag-to-rotate the camera needs ~30 lines of math.
- **Dependencies:** Zero.
- **Debugging:** Excellent. Every facelet is an HTML element you can inspect, restyle live, etc. The whole scene is in the DOM tree.
- **Limitations:** Flat-shaded look (no proper lighting). Depth sorting can occasionally glitch when many planes overlap (not a problem for a 2x2). Rendering multiple cubes side-by-side is easy (just more `<div>`s).

### A2. Raw WebGL

Write shaders in GLSL, upload geometry to GPU buffers, manage matrices yourself.

- **Conciseness:** Poor. ~500–1000 lines for the basics (shader setup, matrix math, buffer management) before anything cube-specific.
- **Dependencies:** None strictly required, but you would typically pull in a small math library such as `gl-matrix` (~20 KB) for vector/matrix operations.
- **Debugging:** Mediocre. DevTools see WebGL calls but not GPU state well. Shader errors are cryptic. A browser extension called *Spector.js* helps.
- **When justified:** Educational, or extreme bundle-size constraints. Not justified here.

### A3. Raw WebGPU

Same idea as raw WebGL but with the modern API. Slightly nicer to use, but more verbose initial setup. Browser support is still maturing; Safari/Firefox lag behind Chrome.

- Same conciseness/debugging trade-offs as raw WebGL.
- Not recommended for this app unless you specifically want to learn WebGPU.

### A4. Three.js

The dominant 3D library on the web. Provides Scene / Camera / Mesh abstractions, geometry primitives, materials with lighting, animation helpers, `ArrowHelper` for arrows, and **OrbitControls** for pointer-driven camera rotation — exactly what this app needs.

- **Conciseness:** Good. A scene with 8 cubies + orbit controls + lighting is ~50–100 lines.
- **Dependencies:** One main package (`three`, ~600 KB minified). Optional `@types/three` for TypeScript.
- **Debugging:** Good. Plain JS objects; standard DevTools debugging applies. The scene graph is inspectable.
- **Ecosystem:** Very large. Many tutorials, many StackOverflow answers, many addon packages (e.g. text labels via `CSS2DRenderer` or `troika-three-text`).

### A5. Babylon.js

Microsoft-backed alternative to Three.js. More game-engine-flavored: built-in GUI module, physics, asset pipeline, an in-browser Inspector that overlays the running scene.

- **Conciseness:** Comparable to Three.js for this app.
- **Dependencies:** One main package (`@babylonjs/core`, ~1.5 MB full; smaller subsets available).
- **Debugging:** Very good — the built-in Inspector is a standout feature.
- **Verdict:** Excellent library but slightly overkill here; Three.js is more idiomatic for small web apps and has more learning resources.

### A6. Wasm-based engines

Compile a Rust / C++ / Godot project to wasm + WebGL/WebGPU.

- **Rust + Bevy** — full ECS game engine. Code is reasonably concise in Rust terms but Rust itself is more verbose than JS. Bundle ~5–15 MB.
- **Rust + macroquad or three-d** — smaller, simpler Rust 3D libraries. Bundles a few MB.
- **Godot 4** with HTML5 export — visual scene editor and GDScript. Bundle ~20–30 MB; great editor experience.
- **C++ + raylib + Emscripten** — minimal C++ option. Bundle a few MB.

Across the wasm options:

- **Conciseness:** Varies; Godot is most concise thanks to its editor; Rust/C++ tend to be more verbose than JS.
- **Dependencies:** Whole separate toolchain (Rust + cargo, or Emscripten, or the Godot editor) plus a JS shim.
- **Debugging:** Hardest. Setup-dependent. `console.log`-style works fine; interactive debugging is more work.
- **Bundle size:** 10x–50x larger than JS options.
- **When justified:** Compute-heavy apps, teams already using these ecosystems, or shared code with a native build. Not justified here — rendering needs are tiny and the solver finishes in seconds in plain JS.

## 4. Axis B — UI framework

For the handful of widgets in this app:

- **Vanilla DOM + JS** — write HTML, attach event listeners with `addEventListener`. Zero deps. Adequate for a small fixed set of widgets.
- **Svelte** — compiles to vanilla JS at build time, so there is no framework runtime in the final bundle. Very concise syntax. Tiny output.
- **React** — most popular; component model with explicit re-render semantics. Pairs naturally with **react-three-fiber** (`@react-three/fiber`), which lets you describe a Three.js scene declaratively as JSX (`<mesh><boxGeometry/></mesh>`) instead of imperative `new THREE.Mesh(...)`. Helpers in `@react-three/drei` include `<OrbitControls/>`, text labels, etc.
- **Vue** — similar niche to React, slightly gentler learning curve.
- **Lit / Web Components** — minimal framework built on browser-native custom elements.

For this app, **vanilla DOM** is sufficient. A framework only earns its keep if you want the declarative scene description that react-three-fiber provides, or if you expect the UI to grow significantly.

## 5. Axis C — Solver

A 2x2 cube has 3,674,160 reachable configurations and a known maximum solution length (God's number) of 11 face-turn moves (or 14 quarter-turn moves). Breadth-first search from the current state, or precomputed BFS from the solved state, fully explores the space.

- **In plain JS:** Encode state as a small integer or short string, BFS with a `Map`/`Set` of visited states. ~100–200 lines. Finishes in seconds; well under a second with a compact state encoding.
- **In wasm:** Faster but unnecessary at this size.
- **Concurrency:** Run the solver in a **Web Worker** so the UI stays responsive while it computes. Workers communicate with the main thread via message passing. Built into the browser; no library required.

The solver implementation is independent of the rendering and UI choices.

## 6. Concrete stack proposals

Three stacks, ordered from "minimum dependencies, more app code" to "more dependencies, less app code":

### Stack S1 — Minimal dependencies

- **Rendering:** CSS 3D transforms (A1)
- **UI:** Vanilla HTML + JS (B-vanilla)
- **Solver:** Plain JS in a Web Worker
- **Build tool:** None strictly needed; an `index.html` plus a few `.js` and `.css` files can be served as static assets. Optional Vite for convenience.
- **Total runtime deps:** Zero.
- **Estimated app code:** ~800–1200 lines.
- **Bundle size:** A few KB.
- **Pros:** Smallest footprint, deployable anywhere, every facelet is an inspectable DOM element.
- **Cons:** Flat-shaded look. You write the drag-to-rotate math yourself (small, but not free). No physics-quality animation easing without writing it.

### Stack S2 — Balanced (recommended)

- **Rendering:** Three.js (A4)
- **UI:** Vanilla HTML + JS for buttons / dropdown / color palette; Three.js scene for cubes and arrows
- **Solver:** Plain JS in a Web Worker
- **Build tool:** Vite (dev-time only).
- **Total runtime deps:** `three` (+ optional `@types/three` if using TypeScript).
- **Estimated app code:** ~500–800 lines.
- **Bundle size:** ~600 KB.
- **Pros:** Three.js handles the genuinely fiddly parts (3D math, lighting, `OrbitControls`, arrow helpers). Large community. All-JS stack — debug straightforwardly in DevTools.
- **Cons:** Modest learning curve for the Scene / Camera / Renderer model.

### Stack S3 — Maximum convenience

- **Rendering:** Three.js via **react-three-fiber** + **drei** helpers
- **UI:** React for widgets
- **Solver:** Plain JS in a Web Worker
- **Build tool:** Vite.
- **Total runtime deps:** `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`.
- **Estimated app code:** ~400–600 lines.
- **Bundle size:** ~800 KB.
- **Pros:** Declarative scene (`<mesh/>`, `<OrbitControls/>`, `<Html/>` for labels). Components compose cleanly. Easy to grow.
- **Cons:** More concepts to learn at once (React lifecycle and hooks + R3F's bridging rules + Three.js fundamentals). Build step is no longer optional.

A wasm stack (Rust+Bevy, Godot, etc.) is viable but not proposed here: bundle size is much larger, debugging is harder, and the performance headroom isn't needed for a 2x2 cube and a sub-second BFS.

## 7. Recommendation

**Stack S2 (Three.js + vanilla JS + Web Worker).** Rationale:

- Three.js absorbs the parts that are tedious to write from scratch — 3D math, lighting, the pointer-driven camera, arrow helpers, text labels — for one well-documented dependency.
- Vanilla JS for the few UI widgets keeps the rest of the app simple and avoids adopting a UI framework whose features this app would barely use.
- All code is JS/TS, so the standard browser debugger works for everything.
- The codebase remains small enough to read end-to-end, and an upgrade path to S3 exists if the UI grows.

If absolute minimum dependencies matter more than code size, **Stack S1** is a respectable choice — a 2x2 cube is genuinely small enough for CSS 3D transforms to be a sensible target. If a declarative component model is preferred from the start, **Stack S3** is fine; the extra dependencies are well-maintained.
