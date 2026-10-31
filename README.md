# ArchNova — AI House Design (Frontend Prototype)

Frontend-first prototype of **ArchNova**, the AI house design & visualisation studio by Pixel Studios.
Built with **React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router + React Three Fiber**,
following the supplied reference mockup.

> This is a browser-first prototype with local project storage. The assistant can call the Groq
> Chat Completions API when the user supplies their own API key; there is no server-side key vault,
> backend database, or production export pipeline. AI-produced geometry is conceptual and is not
> building-code, structural, permit, or construction validation.

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

No build-time secrets or Docker are required. Project data is stored in browser `localStorage`.
The optional Groq key is entered in the assistant and held in that tab's `sessionStorage`; requests
are sent directly from the browser to Groq, so do not use this on a shared/untrusted browser.

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

### Real asset starter library

The asset library now includes 24 locally bundled Poly Haven CC0 glTF models and 6 PBR material sets. Real models are not auto-placed into existing projects: open **Assets**, preview a model, choose **Place**, then click a room (for furniture) or the site plan (for landscape/site objects). Open **3D View** to inspect the placed model; use **Save** and reload to confirm its catalog identity persists. In the workspace's left tool drawer and room Properties panel, imported model tiles also show live model previews. The complete inventory, source/licensing and known coverage gaps are recorded in [`docs/ARCHNOVA_REAL_ASSET_MILESTONE.md`](docs/ARCHNOVA_REAL_ASSET_MILESTONE.md).

The workspace also hosts the **AI Assistant** slide-over panel. Paste a Groq key and model ID,
test the connection, describe a complete floor plan or request room-shape, room-size, door/window, furniture, or finish
edits, then review and apply the proposed operations. Supported edits update the shared 2D/3D project
model and save to the current project. The assistant key is never saved in project/chat data.
Geometry checks are guardrails, not code compliance. Both side panels (workspace rail and
properties) collapse with arrow buttons; the 2D canvas switches to 3D with a tab.

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
  lib/             format, storage, id, floorPlan, furniture/architecture geometry, plan validation
  services/        projectService (localStorage), groqAssistant (direct client), export/model stubs
  hooks/           useProjects, useLocalStorage, useMediaQuery
```

## Groq assistant

1. Open a project workspace and select **Assistant**.
2. Paste a Groq API key in the **Groq API key** field. It is held only in the current browser
   tab's `sessionStorage`; it is not written to project data or chat history.
3. Keep the default model ID (`openai/gpt-oss-20b`) or enter one available to your account. Use
   **Check models** to verify the key and load the models your account can use; ArchNova will
   switch away from an unavailable model automatically.
4. Describe a new floor plan or changes to existing rooms. The assistant returns a constrained JSON
   plan, which the app validates and shows for review. **Apply and save** writes accepted edits to
   the current project and updates the live 2D/3D editor. **Discard** makes no design changes.

The browser sends prompts and project context directly to Groq; this prototype has no server proxy.
Review your provider settings and do not paste secrets into the chat prompt. AI-generated layouts
are schematic and are not professional, structural, permit, or building-code advice.

## Remaining prototype boundaries

* **Geometry engine** — the editor has editable rooms, shared walls, openings, and furniture, but
  arbitrary partial-wall intersections/custom room splitting are not fully robust.
* **3D** — `MassingCanvas.tsx` is a stylized massing/fixture preview, not a construction model.
* **Exports** — `exportService.exportDocument` still reports labelled preview/coming-soon results;
  floor-plan printing can use the browser's Print / Save as PDF dialog.
* **Storage** — project persistence is local browser storage; no synchronized backend exists.

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

* The assistant uses the user's Groq key to propose conceptual room-plan edits; the user reviews each
  action before application. Generated plans are not code-compliance or structural validation.
* The 3D view is an interactive **massing** preview, not a finished render or construction model.
* Document-export controls still identify preview/coming-soon results; floor-plan printing is
  available through the browser print dialog.
* Geometry warnings flag common room, opening, furniture and plot conflicts only; they do not
  establish building-code compliance.
