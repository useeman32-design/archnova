# ArchNova — AI House Design (Frontend Prototype)

Frontend-first prototype of **ArchNova**, the AI house design & visualisation studio by Pixel Studios.
Built with **React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router + React Three Fiber**,
following the supplied reference mockup.

> This phase is **UI only**. There is no backend, no database, no real AI, no payments and no
> production export. Everything labelled *simulated*, *preview* or *coming soon* in the interface
> is intentionally inert and clearly marked.

---

## Running the app

```bash
npm install       # once
npm run dev       # dev server on http://localhost:5173
```

Other scripts:

```bash
npm run typecheck # tsc -b --noEmit
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build
```

No environment variables, no services, no Docker. The app runs entirely in the browser;
demo data is seeded into `localStorage` on first load.

## Routes

| Path                    | Screen                                                    |
| ----------------------- | --------------------------------------------------------- |
| `/`                     | A — Home dashboard (welcome banner, recent projects, plan card) |
| `/projects/new`         | B — 11-step new-project questionnaire (draft auto-saved)   |
| `/projects`             | H — My Projects (search, status filter, open/duplicate)    |
| `/drawings`             | G — Drawings & exports across projects                     |
| `/assets`               | Asset library: 3D objects, textures & materials, interior, trees |
| `/settings`             | I — Settings & account (profile, units, currency, theme)   |
| `/workspace/:id`        | C/E — Design canvas: 2D Plan / 3D Preview tabs, zoom + measure, properties panel |
| `/workspace/:id/assets` | Asset library inside the workspace (objects, textures, interior, trees)  |
| `/workspace/:id/3d`     | F — 3D preview (orbit/zoom, exterior/interior, roof & finish switches)   |
| `/workspace/:id/drawings` | G — Drawing set for one project                            |

The workspace also hosts the **D — AI Assistant** slide-over panel (toolbar button or
`?assistant=1`), clearly labelled as a simulated demonstration. Both side panels (workspace
rail and properties) collapse with arrow buttons; the 2D canvas switches to 3D with a tab so
only one preview is on screen at a time.

## Folder structure

```
src/
  components/
    layout/        AppShell, Sidebar, MobileNav, Logo
    dashboard/     WelcomeBanner, ProjectCard, HowItWorks, PlanCard, QuickAccessStrip
    forms/         StepShell, OptionGrid, steps/* (questionnaire)
    editor/        PropertiesPanel (Room/Wall/Door/Window tabs)
    floor-plan/    FloorPlanDiagram (SVG), PlanCanvas (zoom + grid)
    3d-viewer/     MassingViewer (lazy R3F scene + error boundary)
    ai-assistant/  AssistantPanel
    drawings/      DrawingsView (document cards + export stubs)
    illustrations/ HouseIllustration (parametric SVG house)
    ui/            Button, Card, Badge, Field, FormControls, Modal, Feedback, ProgressStepper
  pages/           HomePage, NewProjectPage, ProjectsPage, DrawingsPage, SettingsPage, NotFoundPage
  pages/workspace/ WorkspaceLayout + Overview / FloorPlanEditor / ThreeD / Drawings
  data/            catalog (options), projects (samples), documents (drawing set)
  types/           Domain models: Project, Plot, Room, Element, Budget, preferences, exports
  lib/             format, storage, id, floorPlan (demo layout builder), projectFactory, defaultForm
  services/        Contracts only: projectService (localStorage impl), aiService (simulated),
                   geometryService, threeModelService, costService, exportService (placeholders)
  hooks/           useProjects, useLocalStorage, useMediaQuery
```

## Swapping in real systems later

* **Project API** — implement `ProjectService` (`src/services/projectService.ts`) against your
  PHP/MySQL REST endpoints; components only use the interface via `useProjects`.
* **AI** — replace `createSimulatedAIService()` with a client for the interpretation API; the
  assistant panel already renders `InterpretationResult` (summary, suggestions, warnings).
* **Geometry engine** — `src/lib/floorPlan.ts` is a demo-only layout builder; replace with the
  real engine producing `Floor[]/Room[]` in the same shapes.
* **3D** — `MassingCanvas.tsx` (React Three Fiber) is the placeholder scene; swap in a GLTF-loaded
  model through `threeModelService` without touching the pages.
* **Exports** — `exportService.exportDocument` currently returns labelled "preview" results.
* **Storage** — all persistence funnels through `src/lib/storage.ts` (single prefix, JSON).

## Sample data

Three demonstration projects are seeded on first run (3 Bedroom Bungalow — 50 × 50 ft — Gusau;
2 Bedroom Modern House — 40 × 60 ft; 4 Bedroom Duplex — 60 × 80 ft). Reset them any time from
**Settings → Prototype data**.

## GitHub Pages preview

A static preview of the prototype is published from the `gh-pages` branch:

```bash
npm run build:pages   # builds with BASE_PATH=/archnova/ + SPA 404.html fallback
```

Then publish `dist/` as the root of an orphan `gh-pages` branch (one-time setup is already
done for this repo; to refresh the preview after UI changes):

```bash
git checkout --orphan gh-pages-tmp
git rm -rf --cached . >/dev/null
cp -r dist/* . && cp dist/404.html .
git add -A && git commit -m "chore: publish pages preview"
git branch -M gh-pages-tmp gh-pages
git push -f origin gh-pages
git checkout main
```

GitHub Pages is configured with source = `gh-pages` branch, root folder. The site lives at
`https://useeman32-design.github.io/archnova/`. Deep links work through the `404.html` copy of
`index.html` (the SPA router resolves the path client-side).

## Mobile

Responsive by design: bottom tab navigation with a raised "new project" action, questionnaire and
dashboard adapt to single column, and the workspace properties panel becomes a bottom-sheet drawer
instead of squeezing the desktop grid. The 3D viewer and plan canvas remain touch-friendly
(orbit/pan/zoom gestures).

## Honest-labelling rules honoured in this prototype

* The assistant never claims to generate a design; every reply is marked *Simulated response*.
* The 3D view is an interactive **massing** preview, labelled as such — not a finished render.
* Export buttons report preview/coming-soon states instead of producing files.
* Dimension/area figures come from the demo layout builder and are marked as demonstration values.
