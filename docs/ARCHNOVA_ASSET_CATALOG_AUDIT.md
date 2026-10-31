# ArchNova Master Interior & Exterior 3D Asset Collection — Audit & Starter Plan

**Audit date:** 2026-10-31
**Scope:** repository audit, target taxonomy, source/license screen, and staged implementation plan. No third-party model or texture files were downloaded or incorporated during this audit stage.

> **Milestone update (2026-10-31):** The first real-asset milestone and a modest follow-up collection are now integrated. Twenty-four CC0 Poly Haven GLTF models and six PBR material sets are locally bundled; all 24 models were checksum-verified and parsed with Three.js GLTFLoader. The current exact asset list, rights, workflow verification and remaining category gaps are in [`ARCHNOVA_REAL_ASSET_MILESTONE.md`](./ARCHNOVA_REAL_ASSET_MILESTONE.md). Sections below describe the repository as it stood during the initial audit; they are historical, not the current implementation state.

> **Checklist note:** The prompt contains the core requirements and broad asset families, but I could not find a separate, item-by-item checklist attached or in the repository. This document expands the categories explicitly named in the prompt into a proposed working taxonomy. If there is a canonical checklist, it should be compared against this taxonomy before declaring coverage complete.

## 1. Executive audit

ArchNova already has a useful **parametric architectural editor and shared project state**, but it does not yet have a production GLB/glTF asset collection or a real 3D asset-loading pipeline.

- `src/data/assets.ts` contains **31 catalogue records**: 7 building/site “objects”, 7 material swatches, 11 interior items, and 6 landscape items. The records have stable-looking string IDs, names, broad categories, tags, icons, and a few colour swatches. They have **no model file, model thumbnail, dimensions, placement/orientation metadata, material assignments, source, creator, license, or commercial-use status**.
- `src/components/assets/AssetsView.tsx` renders icon/swatch cards. Its search filters name and tags. “Add” is enabled only for records that `variantFromAsset()` can heuristically map to an editor tool; several catalogue records are preview-only or mapped by name rather than by a precise model identity.
- `src/data/toolLibrary.ts` contains broader editor variants for rooms, doors, gates, windows, furniture/appliances, and site objects. Most variants have nominal dimensions, but not real model files or licensing data. Ten assistant site-choice thumbnails exist under `public/previews/`; these are **preview images, not 3D models** and do not turn the catalogue into a GLB library.
- `src/services/threeModelService.ts` is explicitly a placeholder service (`isReady()` is false; `loadModel()` returns false). `MassingCanvas.tsx` builds the 3D scene directly from project data using Three.js primitives and procedural geometry. There are **no `.glb`, `.gltf`, or `.bin` model files in `public/`** and no application-level GLTF loader path in the current renderer.
- Current procedural systems already cover much of the *configurable geometry* requirement: room/floor walls and openings, several roof forms, site roads/paths, fences/gates, and stairs/architectural massing. These are dimension-driven scene geometry, not detailed downloadable assets. Furniture, vehicles, people, trees, plants, and lights are currently simplified procedural meshes; furniture commonly falls back to boxes, and vegetation to basic shapes.
- `Project` already shares floors, rooms, walls/openings, interior `PlacedItem`s, buildings, and site `landscape` items between editor views. Existing editor operations include selection, placement, movement, rotation/scale for supported placed items, delete, and duplicate for interior placed items. The asset library itself does not yet carry a stable `assetId` into these placed instances; site-item duplication and full model-specific 2D symbols also need audit/implementation.
- The Groq assistant currently proposes semantic `item` strings and `SiteElementKind` values, not catalog `assetId`s. Thus the user requirement “AI selects only assets that exist in the actual catalog” is **not yet satisfied**. There is no catalog-to-assistant allowlist or path resolver.
- There is no complete PBR material library. Current material catalogue entries are swatches, and the 3D renderer uses local colours/generated canvas textures and `meshStandardMaterial` values rather than shared sourced texture sets.

### Existing vs. missing at a glance

| Requirement | Current state | Gap |
|---|---|---|
| Unified Interior / Exterior & Site taxonomy | Four broad UI groups (`objects`, `textures`, `interior`, `trees`) | No two-section hierarchy or full subcategory tree |
| Detailed GLB/glTF assets | None in repository | Source, vet, optimize, license, and load real models |
| Parametric structure | Walls/openings, roofs, some site elements and stairs are generated in code | Improve construction detail/materials and make systems explicit catalogue families |
| PBR materials | Colour swatches and generated/basic materials | No real shared material records or texture maps |
| Asset metadata | IDs, name, broad category, tags, icon | Add preview/model refs, dimensions, axes/pivot, placement, materials, source/license evidence and commercial status |
| Search/preview/place/edit | Search + icon cards; some 2D/3D placement/editing | True model previews, exact asset identity, full lifecycle parity; site duplicate needs work |
| Shared 2D/3D project model | Yes for room items, openings and site items | Store catalog `assetId` and provide appropriate 2D symbols for imported models |
| AI catalog integrity | Semantic strings/enums | Constrain actions to catalog IDs / approved parametric system IDs; reject unknowns |

## 2. Proposed unified catalogue taxonomy

Use two top-level sections and shared materials. Structural systems should be represented as **parametric families** rather than frozen objects; static detailed items should be **GLB/glTF model assets**.

### A. Interior Assets

1. **Architectural systems (parametric)**
   - Walls: exterior, interior, partitions, columns, beams, slabs, ceilings, skirting, trims.
   - Openings: single/double/sliding/pocket/folding doors; interior/entry/garage doors; casement/sliding/fixed/bay windows; glazing, shutters and hardware.
   - Stairs and circulation: straight/L/U/spiral stair systems, landings, balustrades/handrails, ramps.
   - Room and joinery systems: kitchen cabinet runs, islands, wardrobes, shelving, counters, reception desks, built-ins.
2. **Living and lounge** — sofas/sectionals, armchairs, accent chairs, coffee/end tables, media units, rugs, decorative objects, lamps.
3. **Bedroom** — single/double/king beds, mattresses/bedding, bedside tables, wardrobes, dressers, mirrors, bedroom lighting.
4. **Dining** — dining tables, chairs, stools, sideboards, serving furniture.
5. **Kitchen and appliances** — cabinet modules, sinks/taps, cooktops/ranges, ovens, refrigerators, freezers, microwaves, dishwashers, small appliances.
6. **Bathroom and laundry** — WC, basins, baths, shower trays/enclosures, taps, accessories, washing machines/dryers.
7. **Office, education and institutional** — task desks/chairs, workstations, meeting/conference tables, filing/storage, reception/waiting furniture, classroom furniture, library shelving, appropriate medical/institutional equipment.
8. **Lighting** — ceiling/pendant, recessed, wall, task, table/floor lamps, emergency and exit-light families where appropriate.
9. **People and interior entourage** — licensed scale figures, plants, artwork, books and decor.
10. **Interior materials** — paint/plaster, concrete, timber, stone, tile, terrazzo, carpet, fabric, glass, metals and plastics.

### B. Exterior & Site Assets

1. **Building/site construction systems (parametric)**
   - Roofs: flat, gable, hip, shed, dome and modular roofing assemblies; ridge/eave/soffit/fascia/gutter details.
   - Boundary walls, retaining walls, piers, fences/railings and dimensioned gate systems.
   - Roads, driveways, parking bays, sidewalks, paths, curbs, ramps, markings and paving layouts.
   - Exterior stairs, ramps, canopies, pergolas, terraces, balconies and site structures.
2. **Landscape and vegetation** — broadleaf/conifer/coastal trees, palms, shrubs, hedges, flowers, grass/ground-cover, planters and soils.
3. **Vehicles and people** — cars, accessible parking/vehicle types and scale figures; check brand, likeness and model-release rights.
4. **Exterior lighting and street furniture** — street/security lights, bollards, benches, bins, signs, cycle stands and bus-stop/site furniture.
5. **Site utilities/context** — drainage grates, utility boxes, hydrants, meters and safe generic contextual structures where needed.
6. **Exterior materials** — render, brick, stone, concrete, roofing, timber, metals, glass, asphalt, pavers, soil, grass, water and planting substrates.

### Shared PBR Material Library

Each material record should specify the maps actually present: base colour/albedo, normal (and convention), roughness, metallic, ambient occlusion, optional height/displacement and opacity. Include colour space, UV scale/tiling, physical scale, preview, source, license and compatible renderer notes. Avoid pretending a single colour swatch is a sourced PBR material.

## 3. Candidate record contract

A catalog entry should be immutable/versioned and contain at least:

```ts
interface AssetRecord {
  id: string                    // stable ArchNova ID, never supplied as a file path by AI
  name: string
  section: 'interior' | 'exterior-site' | 'shared-materials'
  category: string
  subcategory: string
  kind: 'gltf-model' | 'parametric-system' | 'pbr-material'
  thumbnail: string             // local, optimized image
  model: {
    glb?: string                // runtime-optimized, same-origin/catalog-controlled path
    sourceFormat?: 'glb' | 'gltf' | 'blend' | 'fbx' | 'obj'
    parametricSystemId?: string // validated code-side key, not arbitrary model text
    referenceGlb?: string       // optional generated family preview for parametric entries
  }
  dimensions: { width: number; height: number; depth: number; units: 'm' }
  transform: {
    upAxis: 'Y'
    forwardAxis: '+Z' | '-Z'
    origin: string
    defaultRotationDegrees: number
    placement: string[]
  }
  materials: string[]           // references to shared material records
  source: { provider: string; sourceAssetId: string; url: string; creator?: string; acquiredAt: string }
  license: {
    name: string; url: string; commercialUse: 'yes' | 'no' | 'verify'
    attributionRequired: boolean; redistribution: 'yes' | 'no' | 'custom'
    evidence: string; verifiedAt: string
  }
  runtime: { triangleCount?: number; lods?: string[]; textureBudget?: string; reviewStatus: string }
  symbol2D?: { kind: string; footprint?: [number, number] }
}
```

A **parametric family** remains adjustable and is generated from explicit project parameters; its `parametricSystemId` maps to deterministic code. It should not be replaced by a rigid GLB just to satisfy the model-reference field. If the library schema requires every card to show a model preview, generate a lightweight *reference preview GLB* for the family, while marking that file as preview-only and keeping placement geometry parametric.

Placed instances should store `assetId`, transform, parent room/floor/site, dimension overrides, parametric values (when applicable), material overrides, and a migration-safe legacy item key. Store catalog source/license snapshot or a stable reference to the immutable catalog version. Renderers must resolve an `assetId` only through the catalog; they must never load a path invented by the model.

## 4. Source and license screen

**Policy recommendation:** start with CC0 source assets and original procedural systems. Add non-CC0 models only after confirming that the license permits incorporation into a commercial, multi-user SaaS and the intended customer export/sharing workflow. A purchase that permits commercial rendering does not automatically permit serving a retrievable GLB to every browser user.

| Source | Useful content / formats to investigate | License posture for ArchNova SaaS |
|---|---|---|
| **Poly Haven** | Detailed scanned/modelled props, furniture, appliances, lighting, trees; GLTF plus other formats and PBR maps. Strong first source for realistic residential/office props and materials. | All assets are CC0 per its official license page: commercial use, redistribution and attribution-free use are allowed. Record the exact asset page and contributor anyway. Best low-friction starter source. |
| **ambientCG** | PBR surface maps, HDRIs, terrain/3D assets; map downloads are commonly ZIPs with JPG/PNG/EXR; some terrain/model assets are OBJ. Best shared-material source, not the primary furniture source. | Official site says all assets are CC0 and available for commercial use without attribution. Still record individual asset ID and downloaded files. |
| **Quaternius** | Pack-level glTF/FBX/OBJ/Blend. Useful for people, nature, vehicles and broad site context; style is usually stylized/low-poly, so do not let it dominate photoreal architectural renders. | Packs checked here identify CC0 and commercial use. Verify the exact pack and version. Prefer glTF packs; convert other formats through a tested pipeline if used. |
| **Sketchfab** | Large model range; downloadable format and license vary by individual listing. glTF/GLB may be available. | Sketchfab’s developer guidance requires license and creator/source attribution to follow CC models through the app and be visible to users. Download API use requires user authentication unless a different arrangement is approved. Use only CC0/CC BY for commercial plans, preserve attribution, and exclude NC; review SA/ND individually. |
| **CGTrader** | Broad professional paid models; formats vary by listing. | Royalty-Free model terms restrict distribution to an incorporated product and say third parties must not be able to retrieve the model on its own. Browser-delivered GLBs are inspectable/retrievable, so do **not** assume standard RF is sufficient for a SaaS asset library. Obtain written seller/enterprise rights for browser delivery and exports or exclude. Editorial/custom/no-AI terms require separate review. |
| **Fab** | Professional models; formats and license tiers vary by product. | Fab Standard License allows commercial use in a project but prohibits standalone resale/redistribution; some listings use CC-BY. A normal browser-served model may be extracted. Use only with clear rights for the intended SaaS delivery and extraction controls, or a custom license; retain per-transaction records. |
| **Blendkit** (formerly BlenderKit) | Blender-integrated model/material library; each listing has its own metadata; some assets may require conversion/export from Blender. | Official terms distinguish CC0 and Royalty Free. Both are described as commercial-use, but RF does not allow reselling the model as a model/asset pack. Do not put RF files in a user-retrievable catalog absent written SaaS redistribution rights; CC0 is the safer path. |

### License verification gates for every item

Before adoption: verify exact product page, creator, asset license/version, commercial permission, attribution wording, redistribution/embedding rights, allowed modification, end-user exports, attribution visibility, trademarks/logos, identifiable people/model releases, and any platform/API restrictions. Keep a local evidence record (license URL, access/acquisition date, invoice if paid, screenshot/text hash, attribution string). “Free download” is not a license label.

## 5. Initial shortlist (historical metadata review; some candidates have since been imported)

These are source pages to vet and test in a controlled first batch. The shortlist is deliberately small; it does not mean every candidate is aesthetically right for every design style.

| Starter use | Candidate | Format / license signal | Notes |
|---|---|---|---|
| Living-room hero prop | [Sofa 02 — Poly Haven](https://polyhaven.com/a/sofa_02) | glTF listed; CC0; about 3K tris; 1.8 m wide | Detailed materialled leather/wood but vintage style; use as one style option, not the only sofa. |
| Lounge seating | [Arm Chair 01 — Poly Haven](https://polyhaven.com/a/ArmChair_01) | glTF listed; CC0; about 6K tris; 1.1 m tall | Victorian/vintage model; preview and inspect for actual fit and UV/material quality. |
| Tables | [Wooden Table 02 — Poly Haven](https://polyhaven.com/a/WoodenTable_02) and [Round Wooden Table 02](https://polyhaven.com/a/round_wooden_table_02) | glTF listed; CC0; about 2K/4K tris; dimensions are shown on the source pages | Good small first-batch load/scale tests. |
| Office | [Metal Office Desk — Poly Haven](https://polyhaven.com/a/metal_office_desk) | glTF listed; CC0; about 7K tris; 2 m wide | Worn/industrial style; useful as an initial office record, but add cleaner contemporary models before calling the office set complete. |
| Kitchen | [Electric Stove — Poly Haven](https://polyhaven.com/a/electric_stove) | glTF listed; CC0; about 14K tris; 0.9 m tall; rigged | Verify rig behavior is unnecessary/stripped, set sensible default scale, and avoid placing it as a free-standing unit if the kitchen system should host it. |
| Interior lighting | [Modern Ceiling Lamp 01 — Poly Haven](https://polyhaven.com/a/modern_ceiling_lamp_01) | glTF listed; CC0; about 6K tris; 1 m tall | Candidate for pendant/ceiling fixture; placement metadata should define ceiling mounting/origin. |
| Trees | [Jacaranda Tree — Poly Haven](https://polyhaven.com/a/jacaranda_tree) | glTF listed; CC0; about 312K tris; 24.2 m wide; LODs reported | Visually rich but expensive if used unoptimized. Import only after LOD/decimation and alpha-material profiling. |
| People | [Universal Base Characters — Quaternius](https://quaternius.com/packs/universalbasecharacters.html) | glTF in pack; CC0; average about 13K tris | Stylized/real-time entourage rather than photoreal people; inspect each variation and keep neutral scale-figure placement. |
| Exterior/site context | [Downtown City MegaKit — Quaternius](https://quaternius.com/packs/downtowncitymegakit.html) | glTF listed; CC0; 300+ modular pieces | Stylized city-context kit; not a substitute for photoreal close-up building components. Consider optional background/context use only. |
| Vehicle entourage | [Cars Pack — Quaternius](https://quaternius.com/packs/cars.html) | FBX/OBJ/Blend; CC0; no glTF shown on the pack page | If selected, convert one model to GLB and inspect geometry, materials, proportions and license pack version before use. |
| Shared PBR materials | [ambientCG PBR surfaces](https://ambientcg.com/list?type=atlas,material,decal), [Poly Haven textures](https://polyhaven.com/textures) | CC0; image-map packages | Start at 1K–2K for interactive use; test color space, normal convention, physical scale and texture memory before publishing. |

## 6. Implementation plan (staged, no bulk downloads)

### Stage 0 — Catalog and licensing foundation

- Agree on the canonical item checklist and first-collection scope.
- Replace the current four-kind placeholder records with the two main sections, subcategories, typed metadata and explicit `gltf-model` / `parametric-system` / `pbr-material` kinds.
- Add license/source evidence and “commercial use / redistribution / attribution / AI restrictions” fields. Default unknown or incomplete records to **not publishable**.
- Add schema validation and tests for unique IDs, valid file refs, metadata completeness, supported formats, and license eligibility.

### Stage 1 — Runtime model pipeline

- Extend the existing Three.js/React Three Fiber architecture and `threeModelService` seam; do not replace the renderer.
- Add a catalog-backed GLTF loading component with cache, loading/error states, bounding-box normalization, pivot/orientation/units handling, material cleanup, and disposal. Keep model files out of AI prompt-controlled URLs.
- Build an offline asset-prep step for GLB conversion, geometry/material checks, texture resizing, optional Meshopt/Draco compression and LOD. Benchmark first on several small candidate props before enabling at scale.
- Introduce shared PBR materials and set a per-asset triangle/texture budget.

### Stage 2 — Starter collection by design priority

1. Residential: seating, bed, dining table/chair, nightstand/wardrobe, kitchen appliances, bathroom fixtures, lights, common finishes.
2. Office: desks, task seating, conference/meeting table, storage, reception/waiting, computer/electronics, clean office materials.
3. Institutional: chairs/seating, reception/waiting, desks/tables, storage, generic care/education items that have been license- and proportion-checked.
4. Exterior/site: trees/plants/grass, cars, people, benches/bins, lights; then parametric gates/fences/roads/parking/paths and PBR surfaces.
5. Keep hero architecture and dimension-critical systems parametric. Do not use fixed house/facade GLBs as a replacement for user's editable architectural geometry.

Acquire a few assets at a time, review on mobile/browser and in low/high-end scenes, then expand. Prefer original high-quality parametric systems for walls, openings, stairs, roofs, boundary systems, gates, roads, parking and driveways; GLBs are appropriate for detailed standalone props, furniture, appliances, vehicles, people and plants.

### Stage 3 — Shared project model and editing

- Add catalog `assetId` to furniture/site instances; migrate legacy `item` and `kind` strings without breaking old projects.
- A single placed record must drive both 2D symbol/footprint and 3D mesh. Store transforms/scale/rotation and parametric dimensions in project units; define whether dimensions are catalog-locked or user-overridable.
- Provide selection, placement preview, move, rotate, scale, duplicate and delete across both editor surfaces, with snapping/clearance/placement rules appropriate to each category.
- Use procedural top-down symbols for furniture, devices, trees, cars and site furniture. Preserve dimensioned wall/opening/road systems as actual geometry and keep visual thumbnails separate from project symbols.

### Stage 4 — Search, previews, assistant and rights enforcement

- Search names, section/subcategory, tags, size, style, placement constraints and material; card preview uses real optimized thumbnails and model metadata.
- The AI may return only catalog IDs or validated parametric-system IDs exposed for the current task. Validate every ID against the actual catalog in application code, resolve model paths server/catalog-side, reject unknown IDs, and never accept a model path from the model response. Keep the current proposal and explicit “Apply and save” approval gate.
- Show creator/license attribution where required, provide per-asset provenance, and constrain customer exports to licensed rights.

### Stage 5 — Performance and production QA

- Test GLB loading, slow/offline network, missing textures, fallbacks, instancing/LOD, repeated assets, serialization/migration, 2D/3D transform consistency, and mobile memory/performance.
- Track bundle/network sizes and lazily load category/model resources. Avoid a giant eager download of all assets.
- Audit licenses as a living pipeline; re-check marketplace and API terms before new integration or asset refresh.

## 7. Recommended next implementation milestone

The initial CC0 GLB vertical slice and one measured follow-up batch are complete: 24 imported models and six PBR packages. The current implementation includes local GLTFLoader verification, shared project identity, 2D/3D placement, real previews in Assets and the left tool drawer, PBR application, AI catalog validation and save/reload checks. See [`ARCHNOVA_REAL_ASSET_MILESTONE.md`](./ARCHNOVA_REAL_ASSET_MILESTONE.md).

**Next:** finish browser/WebGL visual acceptance of room rendering, drawer previews and mobile performance before a larger acquisition. Then prioritize still-missing contemporary office seating, full-size bed/wardrobe, refrigerator and bathroom fixtures, vehicles, palm/mature landscape species, and human scale figures. Continue curating one reviewed category batch at a time; don't bulk-download unreviewed sources.

## 8. Source references checked

- [Poly Haven asset license](https://polyhaven.com/license), [models](https://polyhaven.com/models), [furniture](https://polyhaven.com/models/furniture), [architecture](https://polyhaven.com/models/architecture), [nature/trees](https://polyhaven.com/models/nature/trees), [lighting](https://polyhaven.com/models/lighting), [vehicle models](https://polyhaven.com/models/vehicles-transport).
- [ambientCG](https://ambientcg.com/), [PBR surface catalog](https://ambientcg.com/list?type=atlas,material,decal), [3D assets catalog](https://ambientcg.com/list?type=3d-model,terrain).
- [Quaternius Downtown City MegaKit](https://quaternius.com/packs/downtowncitymegakit.html), [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html), [Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html), [Cars Pack](https://quaternius.com/packs/cars.html).
- [Sketchfab Download API guidelines](https://sketchfab.com/developers/download-api/guidelines).
- [CGTrader Royalty Free License help](https://help.cgtrader.com/hc/en-us/articles/360015124437-Royalty-Free-License), [CGTrader commercial use of free models](https://help.cgtrader.com/hc/en-us/articles/360015122437-Can-I-commercially-use-a-free-model), [CGTrader terms](https://www.cgtrader.com/pages/terms-and-conditions).
- [Fab Standard License / EULA](https://www.fab.com/eula?lang=en).
- [Blendkit license types](https://www.blendkit.com/docs/licenses/), [Blendkit FAQ](https://www.blendkit.com/faq-frequently-asked-questions/).

*This is an engineering and sourcing screen, not legal advice. Confirm the actual item license and intended SaaS delivery/export permissions before use.*
