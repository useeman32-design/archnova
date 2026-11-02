# ArchNova Expansion — Audit, Plan & Progress

**Product:** ArchNova by Pixel Studios  
**Tagline:** Design Your Vision. Build Your Future.  
**Status:** Phase 2 site planning includes user-set north/setbacks, boundary access points, building entrances, user-drawn road/path links, conceptual parking bays, and 2D/3D synchronization. The routes/parking release is published at source ref `6f43fc0911d7e23ae17b585ff355cfb209c491b4` and Pages ref `6f2f8beef011668840dcadaa1731588f9e60f79c`; the hosted app serves `assets/index-D77rbeSv.js` and `assets/index-DboByVlR.css`. A verified local follow-up adds draggable recorded building blocks (`25b43fe`) and is not yet published. More complete adjacent-road context, circulation networks, and turning/parking manoeuvre geometry remain. The previous remote `main` ref (`04e946703a71e4187647aae474909f875b65f644`) and Pages ref (`c34753fa58038a010d55d15b5e966375a4dc373e`) were verified; the hosted site served `assets/index-CDiS3FAz.js` and `assets/index-Bnp7tBGl.css`.
**Last updated:** 2026-11-02

This is the durable project log. Read it before starting each follow-up task, update the milestone status after meaningful work, and keep the application buildable. This plan is based on the user's expansion brief and the existing repository audit; it is not a claim of professional or regulatory approval.

## Current milestone

**Milestone 0 — Repository audit and Phase 1 plan: complete.**  
**Milestone 1 — Generalized, backward-compatible project/site model: core foundation complete (commit `4e34770`).**
**Milestone 2 — Phase 2 site planning: interactive polygon editing, edge labels/derived lengths, north/setbacks, footprint checks, access points, entrances, editable road/path routes, and conceptual parking bays are implemented and under regression test. Routes/parking are published in `6f43fc0` and `6f2f8be`; draggable secondary/service building footprints are verified in local commit `25b43fe` and await publication. Richer adjacent-road context, circulation/turning geometry, and fuller site-element integration remain.**
**Milestone 3 — Real asset library: 26 CC0 Poly Haven models and 14 PBR packages are integrated; the 3D site now has procedural sky/sun, textured grass, roof coverings and interlock paths, with climate-hinted assistant landscaping. Remaining content/style gaps are listed in `ARCHNOVA_REAL_ASSET_MILESTONE.md`.**
**Milestone 4 — AI planning: proposal/approval, clarification, validation and recovery flows exist; exact named-asset resolution and bounded asset dimensions/style metadata are supported. Remaining: generate and associate multi-floor rooms/openings with individual proposed building blocks. Supplied logs also confirmed separate Groq completion-length/TPM rate-limit errors; those are provider limits, not editor locking.**

The published source and Pages refs last verified before the current local site-planning edits are `main` at `04e946703a71e4187647aae474909f875b65f644` and `gh-pages` at `c34753fa58038a010d55d15b5e966375a4dc373e`. Cache-busted requests to the hosted URL served `assets/index-CDiS3FAz.js` and `assets/index-Bnp7tBGl.css`. Earlier milestone SHAs and asset history remain recorded below as historical checkpoints. No `.github/workflows` deployment workflow exists; deployment is via the `gh-pages` branch. Do not put credentials in this file or in chat.

**Mobile project-opening finding:** saved projects remain in each browser's `localStorage`; no cross-device API/authentication was introduced. The valid mobile dashboard-to-workspace flow is covered by tests, and the user confirmed mobile project opening now works. The missing-project explanation remains as a fallback. Per the user's scope decision, leave storage device-local and do not pursue cross-device sync unless requested.

## Repository audit — original baseline (historical)

> The repository notes below describe the initial audit before Phase 1, Phase 2 edge-label work, the real-asset pipeline and the current AI improvements. Treat them as a historical baseline; use the current-milestone section and the asset milestone report for present status.

### Current model and persistence

- `src/types/index.ts`: a shared, framework-agnostic `Project` model; currently centered on `buildingType`, rectangular `plot.width/length`, room-oriented `floors`, room geometry, wall/opening data, `landscape`, and preferences. `BuildingType` is a small residential typology enum. There is no first-class project purpose, site boundary polygon, north/orientation, building collection, project brief, or space schedule.
- `src/lib/projectFactory.ts` and `src/lib/floorPlan.ts`: new projects are generated from a house-oriented questionnaire; floors/rooms are generated from bedroom/bathroom counts and preferences.
- `src/lib/storage.ts`, `src/services/projectService.ts`, `src/hooks/useProjects.ts`: browser `localStorage` persistence is behind an async service interface, so schema upgrades belong in a compatibility/migration layer and service mutations.
- `src/data/projects.ts`: sample residential projects are created via the same factory.

### Existing editor, synchronization and validation

- `src/pages/workspace/WorkspaceLayout.tsx`: central workspace state; coordinates project persistence, editing context, unit conversion, room/plot changes, and AI plan application.
- `src/components/editor/PlanEditor.tsx` and `src/components/floor-plan/*`: 2D editing and floor-plan rendering; assume rectangular plots and the legacy `project.floors` projection.
- `src/components/3d-viewer/MassingCanvas.tsx` and `src/services/threeModelService.ts`: existing Three.js / React Three Fiber 3D path; directly reads `project.floors` and plot width/length. Preserve this engine and avoid a parallel renderer.
- `src/lib/architecturalModel.ts`, `src/lib/planValidation.ts`, `src/lib/furniture.ts`: reusable room/wall/opening and furniture geometry/validation utilities. `src/services/geometryService.ts` is explicitly a simulated geometry-service seam, not a real constraint solver.
- `src/lib/applyAssistantPlan.ts` and `src/services/groqAssistant.ts`: controlled AI actions for currently implemented room/project/site-item operations. They do not yet represent the broad site/building operations in the request.

### Asset and product surface

- `src/data/catalog.ts`, `src/data/toolLibrary.ts`, and `src/data/assets.ts` provide option lists and a small placeable catalogue. `assets.ts` explicitly labels real GLTF models and textures as future work; many displayed assets are placeholders/procedural representations.
- `src/components/ai-assistant/AssistantPanel.tsx`: chat UI with review/apply behavior, but no dynamic structured clarification cards or project-brief stage yet.
- `src/services/costService.ts` and `src/services/exportService.ts` exist as limited service seams; do not imply real current pricing or professional construction-document exports without auditing their actual implementation.
- Tests now cover workspace/mobile-missing-project routing, room plans, AI plan application, project migration, site polygon area/containment/self-intersection and outline rendering. Current site geometry covers editable vertices and basic geometric checks; it does not yet model named front/rear/road-facing edges, per-edge dimensions, setbacks, roads, access, or multiple-building placement.

## Technical implementation plan

### Phase 1 — generalized architectural project model (completed core foundation)

Extend existing domain types instead of replacing them:

1. Add extensible building-purpose metadata (category/use/capacity), a project brief, explicit assumptions, and a room/space schedule.
2. Add a site model with units, north/orientation metadata, and an optional actual polygon boundary with stable vertex IDs and provenance. Existing rectangular dimensions may produce a dimension-derived rectangle. If an old project is marked irregular/corner but has no surveyed/drawn points, preserve that fact and mark its boundary as unknown; never silently invent an irregular polygon or assert a false one.
3. Add stable-ID building records with purpose, role/primary designation, footprint metadata, and floor collections. Keep `Project.floors` as the compatibility projection used by the current 2D/3D editor.
4. Add pure model helpers to normalize/migrate old project records and synchronize the primary building with the legacy `floors` field in either direction. Integrate these at project-service read/create/update boundaries, preserving existing saved projects.
5. Update project creation defaults/factory with residential metadata, while leaving room to represent any category/use without forcing a residential template. Do not yet claim support for generating ministry/hospital/plaza layouts.
6. Add tests for legacy migration, rectangle provenance, unknown irregular geometry, primary-building compatibility, and edit synchronization.

**Phase 1 acceptance:** old projects still open; new and migrated records carry extensible purpose/site/building structures; multiple buildings/floors can be represented in the shared model; no fake polygon replaces unknown geometry; 2D/3D continue using the existing primary-building compatibility projection; tests/typecheck/build pass.

### Phase 2 — advanced site planning

First slice is implemented locally: an interactive 2D boundary editor adds vertices by canvas tap/click, drags vertices, computes polygon area and edge lengths, rejects too-few/duplicate/out-of-envelope/self-crossing/zero-area boundaries, and persists actual points with provenance. The same persisted polygon is drawn in the existing 2D and Three.js views. Unknown irregular boundaries remain an explicitly labeled dimensions envelope until points are provided.

Separately recorded non-primary building footprints can now be selected and dragged in the 2D plan (or nudged with arrow keys); the whole polygon translates in saved project data while preserving vertex IDs, entrance anchors, and 2D/3D synchronization. This only moves conceptual building massing—it does not create rooms inside those blocks. Remaining Phase 2 work: fuller adjacent-road context, circulation/turning and parking manoeuvre geometry, and richer synchronization of fences, gates, and landscaping. Boundary access points and building entrance markers are user-designated; road/path routes connect chosen anchors and can be bent by clicking the plan. Conceptual parking bays render in 2D/3D and plan checks flag boundary overflow, building overlap, and bay-to-bay overlap. None of these markers or geometry infer legal access, regulation compliance, or professional approval. Setbacks and building footprints are checked deterministically; edge lengths remain derived from editable vertices. Use actual polygon geometry and explicit assumptions; no local regulations are invented.

### Phase 3 — expanded asset library

Typed asset metadata, search/filter/preview, realistic editable procedural or optimized GLTF assets, lazy loading, 2D symbols, and 3D counterparts. Reuse the existing tool library and render path.

**Implemented locally:** 26 imported Poly Haven CC0 models, 14 PBR sets, real previews in Assets/editor drawer/Properties, stable room/site identity, room GLTF rendering, textured roof/grass/paving, procedural sky/sun and climate-aware assistant context. See `ARCHNOVA_REAL_ASSET_MILESTONE.md`.

**Still open:** browser/WebGL and mobile visual/performance acceptance; remaining model/style categories and parametric gate/selected room-opening thumbnails; profiling repeated/high-poly model use and considering LOD/instancing.

### Phase 4 — AI planning

Keep the existing user-reviewed proposal and controlled supported-action schemas. The current implementation includes purpose/brief context, structured clarification for larger projects, fit choices for separate buildings, diagnostics/recovery behavior, catalog ID validation, and exact-name asset resolution.

**Still open from the roadmap:** broaden supported operations carefully, make room/space schedule and major-change review flows more complete, validate live Groq-provider behavior separately from local normalization tests, and scope a production-safe server proxy. Never expose production API credentials in browser code or claim unsupported actions.

### Phase 5 — professional drawings and visualization

Improve drafting layers, dimensions, schedules, presentation mode and camera presets in the existing 2D/3D path. Keep conceptual/preliminary outputs distinct from construction-ready or legally approved documents.

### Phase 6 — cost and project management

Configurable priced inputs with source/date/confidence, history/undo, comparisons and future export workflows. Never invent current Nigerian prices.

## Module extension map

| Capability | Existing module to extend | New module if needed |
|---|---|---|
| Shared project/site/building types | `src/types/index.ts` | — |
| Project migration and invariants | `src/services/projectService.ts`, `src/lib/projectFactory.ts` | `src/lib/projectModel.ts` |
| Polygon and site geometry | `src/lib/planValidation.ts`, `src/services/geometryService.ts` | `src/lib/siteGeometry.ts` |
| Project brief and space planning | `src/lib/briefParser.ts`, `src/services/groqAssistant.ts` | `src/lib/spacePlanning.ts` |
| 2D project/site display | `src/components/editor/*`, `src/components/floor-plan/*` | only focused components as needed |
| 3D project/site display | `src/components/3d-viewer/MassingCanvas.tsx`, `src/services/threeModelService.ts` | no second renderer |
| Asset catalogue | `src/data/assets.ts`, `src/data/toolLibrary.ts`, `src/pages/workspace/WorkspaceAssetsPage.tsx` | asset metadata module if catalogue outgrows current files |
| Deterministic validation | `src/lib/planValidation.ts`, `src/lib/architecturalModel.ts` | `src/lib/siteValidation.ts` for site-specific rules |
| AI operation application | `src/services/groqAssistant.ts`, `src/lib/applyAssistantPlan.ts` | operation modules only as supported capabilities grow |

## Progress and next actions

- [x] Audit relevant project structure, types, creation, persistence, rendering, validation, AI, assets, tests and extension seams.
- [x] Write down staged implementation plan and acceptance boundary.
- [x] Add backward-compatible purpose, brief, site geometry and multi-building/floor types.
- [x] Add project migration/synchronization helpers and connect them to local project-service boundaries.
- [x] Add project-purpose choices for residential, government, institutional, commercial, industrial, agricultural, mixed-use and custom projects; custom facility notes are saved to the brief. Non-residential projects start with an empty floor instead of a fabricated house layout.
- [x] Add explicit assumption handling: dimension-derived rectangles are marked assumed; irregular/corner plots without points remain unknown and have no fabricated vertices; unknown north/frontage remain unknown.
- [x] Pass concise purpose, brief, building and site-boundary metadata to the current assistant context and instruct it not to claim unsupported planning operations.
- [x] Add Phase 1 regression tests for legacy migration, polygon provenance, non-residential project creation, building/floor synchronization and plot updates.
- [x] Save the Phase 1 foundation checkpoint locally as `4e34770` (`feat: add generalized architectural project model`).
- [x] Add pure polygon area, containment, shape classification and deterministic boundary validation in `src/lib/siteGeometry.ts`.
- [x] Add the 2D plot-boundary editor: tap/click to add points, drag vertices, show area and edge lengths, validate before save, or explicitly choose a dimension-derived rectangle.
- [x] Render the same saved site polygon in the existing 2D plan and Three.js scene; keep unknown boundaries labeled as envelopes.
- [x] Diagnose mobile project lookup: local browser storage is device-local. Replace generic workspace not-found with an explanatory local-storage message; add regressions for opening a saved dashboard card and missing cross-device IDs.
- [x] Run full tests, typecheck and both builds after Groq recovery, edge-label, and assistant diagnostics work. Result: 51 tests pass across 8 files; typecheck and `git diff --check` pass; production and Pages builds pass. Builds retain the >500 kB chunk warning.
- [x] Groq regression recovery: direct design requests with no supported operation now get one strict, compact retry; valid responses still flow into the existing user-approved “Apply and save” proposal. Regression test verifies the retry and recovered action. This verifies the local request/normalization flow, not live Groq provider behavior.
- [x] Add an in-memory assistant diagnostics panel: records prompts, model/progress/request status, raw model responses, parsing/normalized plan, retry decisions, and proposal/apply outcomes; lets the user copy or clear the log. API-key patterns and the entered key are redacted. Logs are not persisted across refresh/project changes; tests cover service trace events and the UI panel.
- [x] Extend Phase 2 boundary editing with optional per-edge standard labels (Front/Rear/Left/Right/Road-facing), custom names, explicit Unknown, and perimeter lengths derived from vertices. Labels persist on vertex-pair metadata and appear with lengths in the 2D site view; no directions are inferred.
- [x] Save the Groq action-recovery fix, regression coverage, and roadmap correction in local commit `7d87b99` (`fix: recover Groq design actions`).
- [x] Save standard/custom site-edge labels and vertex-derived edge lengths in local commit `d93dc4f` (`feat: add site edge labels`).
- [x] Add user-set north orientation with normalization and a user-controlled 2D compass; unknown north remains visibly unknown.
- [x] Add per-edge setbacks to site-edge labels, editor controls and 2D labels; preserve setbacks through plot-unit conversion and make assistant-generated building siting respect those clearances. Regression tests cover compass state, unit conversion, automatic setback-aware placement, and an explicit setback conflict.
- [x] Add deterministic `Check plan` diagnostics for saved building footprints: recorded-boundary overflow, configured setback violations, and pairwise building overlap. Footprints and boundaries are compared in plot units; assistant placement continues to pre-check new recommendations.
- [x] Add edge-referenced vehicle, pedestrian, and service access points to the site model and boundary editor. Save them only with the boundary edit; display matching markers in the 2D plan and 3D massing view; preserve them across unit conversion and include them in bounded assistant context. These do not create road geometry or claims of legal access.
- [x] Add entrance metadata and controls for edges of explicitly recorded building footprints; show corresponding 2D/3D markers and include the data in project/assistant context. Do not fabricate a footprint for buildings without one; the primary building continues to use its existing wall/opening model.
- [x] Add connected conceptual road/path routes between explicit boundary access points and building entrances; direct segments are user-created, bends can be added on the plan, disconnections/out-of-boundary routes/routes through other buildings are checked, and widths/waypoints convert with project units.
- [x] Add editable conceptual parking-bay site objects in 2D/3D and deterministic plan checks for boundary overflow, building overlap, and bay-to-bay overlap. Default dimensions are editable and make no regulatory claim.
- [x] Make separately recorded building footprints selectable and draggable with the select tool; keyboard arrow keys also nudge the selected block. Save the translation to shared project data so 2D and 3D stay synchronized, preserving footprint vertex IDs and entrance references.
- [x] Verify routes, parking, and movable building blocks: 91 tests across 12 files, typecheck, production build, Pages build, and `git diff --check` pass. Node builds use `--max-old-space-size=640` in this memory-constrained workspace; the existing large-chunk warning remains.
- [ ] Improve full campus circulation/turning geometry and richer fence/gate/landscape/site integration; support rooms/openings within each separate multistory block.
- [x] Per user decision, leave project storage browser-local and do not pursue a shared cross-device sync API unless requested.
- [x] Save the Phase 2 site editor and mobile-message work in local milestone commit `be8071e` (`feat: add interactive plot boundary editing`).
- [x] Push `main` with the Groq recovery, Phase 2 edge-label work, and publication-status checkpoints; GitHub accepted the updates.
- [x] Push the built static bundle to `gh-pages` in commit `7a95cac` (`deploy: publish ArchNova updates`).
- [x] Verify the previous Pages delivery: the hosted URL served `assets/index-9ZZDJSFd.js` and `assets/index-BeUFGlsg.css`, matching that build.
- [x] Push assistant diagnostics to `main` (`3af56c2`) and its static bundle to `gh-pages` (`6cc63a3`).
- [x] Verify the new diagnostics build is live: GitHub Pages build for `6cc63a3` completed successfully, and cache-busted hosted requests serve `assets/index-BZOM6Ewe.js` and `assets/index-DqppRJBW.css`.
- [x] Respond to the supplied live-session log: HTTP 429 TPM errors no longer trigger an immediate compact-context retry; SSE/JSON completion metadata (finish reason, usage, response ID/model, content size and done marker) is logged; malformed/empty direct-design responses receive one strict recovery attempt. Recovery results remain proposals and still require the existing user-approved “Apply and save” flow.
- [x] Add regressions for TPM-429 handling, completion metadata, and malformed direct-design JSON recovery. Verification: 54 tests pass, TypeScript build, production build, Pages build, and `git diff --check` pass. Existing large-chunk warning remains.
- [x] Add large-project structured clarification before plan generation: separate building segments/roles, storeys, site elements and current-versus-recommended plot; submit the confirmed brief to the model and retain the existing proposal/“Apply and save” approval gate. A component regression test verifies this path.
- [x] Support separate-building proposals, deterministic fit choices (skip/add anyway/shrink), use remaining plot space before outside overflow, and mark unavoidable overflow red in 2D/3D. Explicit coordinates are not silently moved under strict fit.
- [x] Add local product-render previews for ten site-library variants and connect relevant site-item selection cards; targeted/full tests cover the behavior. Subsequent real-model work now also previews imported streetlights, room furniture and site models. Remaining preview gap: the parametric gate and selected room/opening catalogue variants still lack dedicated product-style thumbnails.
- [x] Verify current assistant/site-fit slice: 60 tests across 10 files pass; `npx tsc -b --pretty false`, `git diff --check`, `npm run build`, and `npm run build:pages` pass. Existing Three.js chunk-size warning remains.
- [x] Fix the interior RoomScene path to render placed catalog GLTFs while retaining the procedural fallback for legacy items; give imported furniture/site model variants a live GLTF preview in the left tool drawer.
- [x] Add ten curated Poly Haven CC0 model records and local packages (dining/coffee tables, vintage day bed, wheelchair, school furniture, street lamp, planter and potted plant); preserve vintage/stylized caveats and document remaining gaps.
- [x] Improve assistant catalog context with dimensions/style metadata and exact name/ID resolution before generic furniture fallback; keep unknown-ID rejection and the user approval gate.
- [x] Verify local work: 69 tests/12 files, typecheck, all 24 GLTF scenes/six PBR sets and 74.4 MB checksum/loader verification; production and Pages builds plus `git diff --check` pass. Builds retain the >500 kB JavaScript chunk warning.
- [ ] Browser-level WebGL visual acceptance of interior model rendering and tool-drawer previews (automation/browser is not available in this workspace); retain as outstanding until manually viewed.
- [ ] Complete remaining non-model catalogue thumbnails (notably the parametric gate and selected room/opening variants); separately complete browser/WebGL visual acceptance for the asset milestone.
- [x] Save the asset/AI/docs update as a local milestone commit (`feat: expand curated real asset library and room previews`).
- [x] Publish the site-planning routes/parking update: remote `main` is `6f43fc0911d7e23ae17b585ff355cfb209c491b4`, remote `gh-pages` is `6f2f8beef011668840dcadaa1731588f9e60f79c`, and live requests serve `assets/index-D77rbeSv.js` plus `assets/index-DboByVlR.css`.
- [ ] Publish the movable-building-footprint fix in `25b43fe` and current docs on top of remote `main` `6f43fc0911d7e23ae17b585ff355cfb209c491b4`. Use the existing browser-based client-side authorization flow only; require a fresh token entered by the user directly in the browser page, never send it to the workspace server, and retain the main branch base-tree safety check.

## Working rules

- Re-read this file before continuing after a pause, then inspect actual source files rather than relying on this summary alone.
- Work in small testable milestones and update the progress section in this file each time.
- Preserve compatibility and the current 2D/3D synchronization path.
- Ask rather than guess for missing project details; list assumptions in the model/brief.
- Do not claim unsupported services, local regulations, structural correctness, or construction readiness.
