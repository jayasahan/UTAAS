# UTAAS frontend

React + TypeScript + Vite scaffold. All routes currently display placeholders;
there is no authentication, business workflow, or API integration yet.

## Local development

Use Node.js 20.20.2+ (20.x), 22.13+ (22.x), or 24+ and npm. CI currently uses
Node 20.20.2 with npm 10.8.2. From this directory:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Optionally copy `.env.example` to `.env.local` for
future API integration. `VITE_*` values are public browser configuration, never
secrets. The example is not currently used to make requests.

## Commands

| Command                | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `npm run dev`          | Vite development server on port 3000                          |
| `npm run build`        | Strict type checking and production build in `dist/`          |
| `npm run preview`      | Preview the production build on port 3000                     |
| `npm run lint`         | ESLint, React Hooks checks, and formatting-rule compatibility |
| `npm run type-check`   | Check application and Vite configuration types                |
| `npm run format`       | Format frontend files with Prettier                           |
| `npm run format:check` | Verify formatting without writing files                       |

Tailwind CSS uses the Vite plugin and CSS-first theme configuration in
`src/styles/globals.css`; a separate Tailwind config file is not needed.
Inter font files are bundled locally through `@fontsource/inter`.

## Structure

- `src/components/common/`: shared UI primitives and placeholder content.
- `src/components/layout/`: application shell and navigation.
- `src/components/tracking/`, `src/components/audit/`: reserved for future UI.
- `src/pages/`: route-level components.
- `src/hooks/`, `src/services/`, `src/types/`: reserved for future shared logic,
  API integration, and types once contracts are agreed.
- `src/assets/`: local visual assets.
- `src/styles/`: global styles and semantic design tokens.

Routes: `/`, `/requests`, `/requests/new`, `/requests/:requestId`, and a
not-found fallback. These browser routes do not define backend endpoints.

The shell uses initial colors from the official UTAAS Figma lecturer screens;
it is foundational layout, not a complete implementation of those screens.
Future interactive views must include accessible loading, error, and empty states.

For production hosting, configure the web server to fall back to `index.html`
for client-side routes. Run this frontend separately for now; the existing
backend and Docker Compose configuration are unchanged.

Design-system usage, visual variants and runtime constraints are documented in
[DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). Run `npm test` for component and
contrast regression tests. Before API-connected work, consult
[BACKEND_COMPATIBILITY.md](docs/BACKEND_COMPATIBILITY.md).
