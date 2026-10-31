# ArchNova — First Real Asset Milestone

**Status date:** 2026-10-31
**Scope:** small, quality-screened acquisition and end-to-end renderer/catalog/project integration. This is not the full target collection.

## Result

ArchNova now has **14 locally bundled, real Poly Haven GLTF models** and **6 locally bundled PBR material sets**, all identified as **CC0 1.0 Universal**. The model browser renders each real local GLTF in a consistent neutral architectural product-preview scene; the same stable catalog ID follows placements through the shared 2D/3D project model and local save/reload. No asset is counted here solely for a catalog row or thumbnail.

Downloaded payload is approximately **53.0 MB** (1K glTF/map packages). The asset folder includes the original source glTF, buffers and dependencies; official URLs, MD5 hashes, dimensions, author/source IDs and license records are in `public/assets/archnova-asset-manifest.json`.

## Imported models (loader-verified)

Dimensions are Poly Haven's approximate source dimensions in **width × depth × height metres**. Triangle counts below are counted from mesh geometry after parsing each local file through Three.js `GLTFLoader`.

| ArchNova ID / Poly Haven source | Dimensions (m) | Loaded triangles | Placement/use note |
|---|---:|---:|---|
| `ph_model_sofa_02` — [Sofa 02](https://polyhaven.com/a/sofa_02) | 1.807 × 0.818 × 0.709 | 2,728 | Real sofa; older/vintage look, not represented as a contemporary sofa. |
| `ph_model_modern_arm_chair_01` — [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01) | 0.820 × 0.987 × 1.023 | 8,916 | Contemporary armchair. |
| `ph_model_mid_century_lounge_chair` — [Mid Century Lounge Chair](https://polyhaven.com/a/mid_century_lounge_chair) | 1.009 × 1.190 × 1.169 | 6,148 | Lounge chair; mid-century styling. |
| `ph_model_modern_coffee_table_01` — [Modern Coffee Table 01](https://polyhaven.com/a/modern_coffee_table_01) | 1.202 × 0.600 × 0.390 | 4,504 | Contemporary coffee table. |
| `ph_model_dining_chair_02` — [Dining Chair 02](https://polyhaven.com/a/dining_chair_02) | 0.434 × 0.576 × 0.973 | 22,013 | Dining chair; no dining-table model in this batch. |
| `ph_model_modern_wooden_cabinet` — [Modern Wooden Cabinet](https://polyhaven.com/a/modern_wooden_cabinet) | 2.440 × 0.520 × 0.680 | 24,976 | Low cabinet; not labelled as a wardrobe. |
| `ph_model_metal_office_desk` — [Metal Office Desk](https://polyhaven.com/a/metal_office_desk) | 2.000 × 0.947 × 0.788 | 6,898 | Real desk; industrial/worn styling. |
| `ph_model_electric_stove` — [Electric Stove](https://polyhaven.com/a/electric_stove) | 0.503 × 0.648 × 0.859 | 13,914 | Kitchen appliance model. |
| `ph_model_modern_ceiling_lamp_01` — [Modern Ceiling Lamp 01](https://polyhaven.com/a/modern_ceiling_lamp_01) | 0.432 × 0.432 × 0.952 | 5,602 | Ceiling placement metadata; positioned to the ceiling in interior view. |
| `ph_model_street_lamp_01` — [Street Lamp 01](https://polyhaven.com/a/street_lamp_01) | 0.704 × 0.386 × 3.871 | 30,610 | Real site light. |
| `ph_model_modular_street_seating` — [Modular Street Seating](https://polyhaven.com/a/modular_street_seating) | 4.340 × 0.770 × 0.950 | 25,156 | Real outdoor bench/street seating. |
| `ph_model_quiver_tree_02` — [Quiver Tree 02](https://polyhaven.com/a/quiver_tree_02) | 0.872 × 0.881 × 1.469 | 82,074 | Decorative tree model; **not a palm** and not a mature full-size tree. |
| `ph_model_concrete_cat_statue` — [Concrete Cat Statue](https://polyhaven.com/a/concrete_cat_statue) | 0.153 × 0.250 × 0.283 | 11,950 | Exterior decor. |
| `ph_model_outdoor_table_chair_set_01` — [Outdoor Table Chair Set 01](https://polyhaven.com/a/outdoor_table_chair_set_01) | 0.776 × 1.831 × 0.859 | 9,828 | Real outdoor dining set. |

The file manifest preserves the exact downloading URLs and MD5 checksums for each main glTF and dependency. All models use Poly Haven's official CC0 asset records. Courtesy credit shown in ArchNova: **Powered by Poly Haven**.

## Imported PBR materials

All six material sets are Poly Haven CC0 and bundled at **1K** resolution. Each has color, OpenGL normal, roughness, ARM and displacement files where provided. The viewer uses color/normal/roughness maps for renderable surfaces; extra maps remain in the source manifest.

| Material category | Source asset | ArchNova application |
|---|---|---|
| Concrete | [brushed_concrete](https://polyhaven.com/a/brushed_concrete) | Real room floor/exterior finish selection. |
| Brick | [brick_pavement](https://polyhaven.com/a/brick_pavement) | Real room floor/exterior finish selection; source is a brick paving surface. |
| Wood | [american_walnut_veneer](https://polyhaven.com/a/american_walnut_veneer) | Real wood room-floor finish. |
| Stone | [stone_pavers](https://polyhaven.com/a/stone_pavers) | Real stone room/exterior finish selection. |
| Asphalt | [asphalt_01](https://polyhaven.com/a/asphalt_01) | Automatically mapped onto dimension-driven road segments. |
| Interlocking paving | [interlocking_concrete_pavers](https://polyhaven.com/a/interlocking_concrete_pavers) | Automatically mapped onto dimension-driven path segments. |

## Workflow implemented

- **Loading/cache:** GLTFLoader-compatible local `.gltf` catalog records use same-origin public paths that honor the Vite deployment base path. Loading fallbacks, per-model failure boundaries, real model previews and checksum verification are present. Active model consumers are reference-counted; after the final consumer releases an asset, deferred cleanup disposes its render resources, clears Drei's URL cache, and also releases any separate preflight GLTFLoader result.
- **Preview/search:** catalog cards show actual GLTF models through a consistent neutral live product-preview renderer; material cards show actual downloaded color maps. Preview is lazy/off-screen aware. Search includes model/material names, tags, source IDs and author.
- **Scale/orientation/pivot:** catalog metadata records dimensions in metres, Y-up/+Z-forward, floor/ceiling/site placement, default rotation and bottom-center placement. Placed interior meshes fit the stored dimensions; site models retain authored proportions and use the project-unit conversion. The ceiling lamp is mounted to the room ceiling rather than placed on the floor.
- **Placement/editing:** manual catalog/tool placement carries the stable `assetId`. Existing shared transform/property flows provide move, rotation, scale, dimensions, delete and interior duplicate. Site-instance duplicate was added; site assets retain their source ID. The existing editable road/path/fence/gate and roof systems remain parametric and dimension-controlled.
- **2D/3D synchronization:** interior assets use the same placed records in the floor plan and Three.js view. Site models carry the same project landscape record; 2D footprints use source dimensions and new top-down symbols for bench/outdoor set/decor where applicable.
- **Save/reload:** `assetId`, transforms, dimensions and site identity remain on the serialized room/landscape records. A UI-level workflow test starts in Assets, arms a real catalog chair, places it into a room, uses Save, and reloads the project to assert the exact asset ID. A separate project-service test preserves interior and site model IDs. Legacy records without `assetId` continue through the existing compatibility rendering path.
- **PBR integration:** actual local maps are used on material-controlled floors/walls and on parametric road/path surfaces; materials are not decorative placeholder swatches.
- **AI catalog guard:** assistant capability data now exposes actual furniture/site model IDs and parametric site-system kinds. New assistant add-furniture/site actions are resolved against the known model catalog; unknown model IDs/categories are rejected. AI does not receive arbitrary model file paths.

## Verification performed

- `node scripts/verify_imported_assets.mjs` / `npm run verify:assets`: verified MD5 for **all 53.0 MB**, parsed **14/14** real model scenes with the Three.js GLTFLoader, and counted non-empty meshes/triangles. The Node verifier stubs only browser bitmap decoding; it still parses the real glTF, binary geometry, material and texture references.
- `npm run typecheck`: passed.
- `npx vitest run --reporter=dot`: **66 tests passed across 12 files**, including catalog eligibility, AI ID guarding, room/site model identity, and a UI-level place → Save → reload workflow for a catalog GLTF ID.
- `npm run build`: passed.
- `npm run build:pages`: passed; public model/material files are copied, and model/material URLs are base-path aware.
- `git diff --check`: passed.
- Production bundle retains the existing large-chunk warning (~1.6 MB minified main JS); the existing Three.js chunk-size warning was not addressed in this scoped milestone.

**Verification boundary:** automated verification proved each local model parses as a real Three.js GLTF scene, and a React Testing Library workflow verified Assets → placement into a room → Save → project reload with the exact stable ID. Deferred cache cleanup is implemented but browser GPU-memory behavior was not profiled. This environment did not provide interactive browser/WebGL visual acceptance, so no pixel-level render or real-device gesture recording is claimed. Visual acceptance should still include a desktop/mobile browser pass.

## Deliberate gaps — not integrated / do not treat as complete

Poly Haven keyword/API review found no suitable contemporary starter asset for these required categories, and this batch did not source them elsewhere:

- contemporary bed, wardrobe, refrigerator, sink/toilet, sedan/SUV, palm tree;
- contemporary office chair and a separate dining-table model;
- people/scale figures and a full species-diverse landscape set.

No procedural furniture/vehicle/plant substitute has been added to the new imported catalog for these absent categories. Legacy projects may still render old generic `item` strings through the existing compatibility fallback, but those fallback objects are not counted as imported assets. The imported sofa and office desk are real source models but have older/industrial styling; future collection work should replace/add more style-appropriate choices.

Roads, paving layouts, driveways, sidewalks, boundary systems, gates/fences and roofs remain editable parametric systems, not imported GLTFs; real PBR maps improve the applicable appearance. No fixed architectural model replaces the current renderer or project model.
