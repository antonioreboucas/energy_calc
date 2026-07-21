# GEMINI.md

This file provides guidance to Gemini (Gemini CLI / Gemini Code Assist) when working with code in this repository.

## Project

PWA frontend for **EnergyCalc** — the user-facing app (landing, auth, dashboard, appliance
registry, simulator, goals, recommendations, subscription) for the Freemium electricity
consumption calculator. Built against the FastAPI backend in `../backend` (see
`../backend/CLAUDE.md` for the API side — same content is relevant regardless of which AI tool
reads it). This is **not** the Super Admin panel — `../DESIGN-DESKTOP.MD` describes that, and it
hasn't been built yet (explicit separate pass).

**Three deliberate, locked-in decisions** (asked of the user before building, don't relitigate):
1. **PHP serves static files only — no templating, no server-side logic.** `router.php` just
   resolves an extension-less URL (`/dashboard`) to its `.html` file on disk; every page is plain
   HTML/CSS/JS. Swappable for any static host later without touching a single page.
2. **MPA, not SPA.** Every screen is its own `.html` file with its own `<script>` bootstrap line
   at the bottom — no client-side router, no framework, no build step. Chosen because it pairs
   naturally with "PHP is just a static server" and makes the service worker's job trivial (cache
   discrete files, not app shell + hydration).
3. Design is translated 1:1 from `../DESIGN-APP.MD` (mobile-first) — its YAML frontmatter tokens
   became `css/tokens.css` custom properties verbatim. `../DESIGN-DESKTOP.MD` is out of scope here.

## Commands

There's no build step. Run two servers side by side:

```bash
# from frontend/app/ (relative paths in router.php require this exact cwd)
php -S localhost:8080 router.php

# from backend/, separately (see ../backend/CLAUDE.md)
python run.py
```

Then open `http://localhost:8080`. If the backend runs on a port other than `8002`, update
`API_BASE` in `js/api.js` **and** `CORS_ORIGINS`/`FRONTEND_URL` in `backend/.env` — both have
drifted out of sync with each other during development more than once; always check both together
rather than assuming one implies the other.

No tests, no linter, no bundler. Verification in this project has meant running both servers and
driving the app for real with Playwright (see any recent session for the pattern) — screenshot
before/after for visual changes, full network+console log capture for anything that "doesn't
work" but doesn't throw an obvious error.

## Architecture

```
frontend/app/
  index.html, login.html, cadastro.html,
  esqueci-senha.html, redefinir-senha.html, verificar-email.html   → public/auth (no login required)
  dashboard.html, residencias.html, aparelhos.html, novo_aparelho.html,
  historico.html, metas.html, recomendacoes.html, assinatura.html,
  perfil.html                                                       → authenticated (call exigirLogin())
  router.php            → extension-less URL → static .html resolver, nothing else
  service-worker.js      → PWA cache, network-first (see gotcha below)
  manifest.json
  partials/               → app-bar.html, bottom-nav.html, nav-publico.html, modal-upgrade.html
  css/tokens.css          → design tokens from DESIGN-APP.MD, as custom properties — never hardcode
                             a color/spacing/radius in a component file, reference a token
  css/base.css            → reset, typography, Inter font (Google Fonts CDN), texto-centro/
                             texto-secundario/forte utilities
  css/componentes.css     → every reusable + page-specific component class (buttons, cards, modals,
                             auth shell, landing sections, aparelho cards, sliders, confirm modal...)
  css/layout.css          → app-bar, bottom-nav, nav-publica, page containers
  js/api.js               → fetch wrapper, API_BASE constant, 401 handling
  js/auth.js               → JWT localStorage + client-side decode, Google Sign-In
  js/ui.js                  → toast, generic modal helpers, tratarErroApi, comCarregamento, confirmarExclusao
  js/layout.js                → partial injection (fetch + innerHTML), app-bar/bottom-nav wiring
  js/paginas/<nome>.js          → one file per authenticated/complex page's page-specific logic
```

- **Partials are injected via `fetch()` + `innerHTML`, not PHP include** — `js/layout.js::carregarParcial()`
  fetches `partials/*.html` into an empty `<div id="app-bar">`/`<div id="bottom-nav">`/
  `<div id="nav-publico">` at the top/bottom of each page. `carregarLayoutAutenticado(paginaAtiva)`
  does this plus `exigirLogin()`, notification badge, avatar/profile-menu population, and highlights
  the active bottom-nav tab by `data-pagina` match. `carregarLayoutPublico()` does the same for the
  landing page's nav only. `#app-bar:empty`/`#nav-publico:empty`/`#bottom-nav:empty` in `layout.css`
  reserve height so the page doesn't visibly jump once the fetch resolves.
- **`js/api.js`**: `apiGet`/`apiPost`/`apiDelete` all funnel through `apiRequest()`, which attaches
  `Authorization: Bearer <token>` from `localStorage`, unwraps the backend's
  `{"detail": {"erro": ..., "mensagem": ...}}` error shape into an `ApiError` (`.message`, `.erro`),
  and on `401` clears the token and redirects to `login` (unless already there). `API_BASE` is a
  **hardcoded constant** (`http://127.0.0.1:8002` as of this writing) — not derived from `location`,
  so it must be updated by hand if the backend's port changes.
- **`js/auth.js`**: `getUsuarioAtual()` decodes the JWT payload client-side (base64url, no
  signature check — this is UI-only, the backend is the real gate on every request).
  `exigirLogin()` is the route guard, called at the top of every authenticated page's inline
  bootstrap script. Google Sign-In (`inicializarGoogleSignIn`) always renders a styled button
  (`GOOGLE_CLIENT_ID = ""` currently) — clicking it without a configured Client ID shows a toast
  instead of silently doing nothing, matching what `POST /auth/google` would do anyway (503).
- **`js/ui.js` — the shared UI vocabulary, used everywhere**:
  - `mostrarToast(mensagem, tipo)` — bottom toast, auto-dismiss.
  - `comCarregamento(botao, texto, acao)` — disables the button, swaps in a spinner, runs `acao()`,
    always restores. **Use this for every button that calls the API** — Neon's serverless cold
    start can take several seconds on the first request after idle, and without this a click looks
    like it did nothing.
  - `tratarErroApi(erro)` — the standard `catch` handler: if `erro.erro` is `"limite_free"` or
    `"upgrade_necessario"` (the backend's freemium-gate error shape), shows the upgrade modal;
    otherwise a generic error toast. Call this in every `catch` unless you have a specific reason
    not to (e.g. a field-level validation message).
  - `confirmarExclusao(mensagem, opcoes)` — **async, returns a Promise\<boolean\>.** Replaced every
    `window.confirm()` in the app (aparelho/residência/meta delete, cancel subscription) with a
    styled modal that self-injects into `<body>` on first call — no page needs to declare its HTML.
    Always `await` it before the destructive call: `if (!(await confirmarExclusao("..."))) return;`.
    Never reintroduce `window.confirm()`/`alert()` — this project deliberately moved away from them.
- **Freemium UX loop**: any endpoint that hits a plan limit returns `403` with
  `{"detail": {"erro": "limite_free" | "upgrade_necessario", "mensagem": "..."}}`. The frontend
  never hardcodes limit numbers for gating decisions — it either lets the backend reject and shows
  `tratarErroApi`'s upgrade modal, or (for banners showing "X of Y used") cross-references
  `GET /assinaturas/minha-assinatura` (which plan) with `GET /planos/` (that plan's limits), because
  `/minha-assinatura` intentionally doesn't embed the limit numbers itself. See
  `aparelhos.js::obterLimiteAparelhos()` / `novo_aparelho.js::carregarResumoPlanoNovoAparelho()` for
  the pattern if adding another limited resource.
- **Aparelho creation lives on its own page (`novo_aparelho.html`), not a modal** — the edit modal
  in `aparelhos.html` is edit-only now. `novo_aparelho.js` has a toggle for two input modes:
  entering `potencia_watts` directly, or entering a known **monthly kWh** (common on Procel/INMETRO
  labels for cyclic-duty appliances like fridges/freezers, and more accurate than watts×hours for
  those since it reflects real average draw instead of assuming constant full-power operation). The
  kWh mode is **purely a frontend calculation** — no backend schema change: it back-solves
  `potencia_watts = (kwh_mes * 1000) / (quantidade * horas_dia * dias_mes)` (the exact inverse of
  the backend's `consumo_diario_kwh = potencia*quantidade*horas/1000` formula — see
  `../backend/CLAUDE.md`) and submits that as a normal `potencia_watts`, so every downstream feature
  (card display, comparador, recommendations, dashboard-by-category) keeps working unmodified. If
  extending this pattern elsewhere, keep the derivation client-side rather than adding a "mode"
  column to `Aparelho` — there's no real need for the backend to know which mode was used.
- **Aparelho list cards show a computed daily cost that the list endpoint doesn't return** —
  `GET /aparelhos/` gives raw fields only (no consumo/custo). `aparelhos.js::carregarAparelhos()`
  renders the cards immediately, then separately fetches each distinct residência's tarifa
  (`GET /tarifas/residencia/{id}`, cached per residência in `tarifasPorResidenciaCache`, first item
  = vigente since the endpoint returns newest-first) and computes
  `consumo_diario_kwh * valor_kwh` client-side to fill in "CUSTO DIÁRIO" after the fact. Don't use
  `/aparelhos/comparar` for this — it's capped at 4 ids and meant for the Comparador feature, not
  general list enrichment.
- **Dashboard charts** use Chart.js via CDN (the one deliberate external asset besides Google
  Fonts/Sign-In) — validated against the `dataviz` skill's palette rules: green (`#006b2c`) for
  energy/kWh series, blue (`#0051d5`) for cost/R$ series, never mixed on the same chart. A recente
  revisão de design do dashboard alterou a forma como os dados são exibidos:
  - `Evolução Mensal`: Gráfico de linha suave (`tension: 0.4`) sem preenchimento, incluindo uma curva secundária de Média.
  - `Por Categoria`: Agora usa o tipo `doughnut` com um plugin customizado (`centerTextPlugin`) para renderizar o "100%" central, e a legenda é gerada via HTML fora do canvas (`#legenda-categoria-container`).
  - `Ranking de Aparelhos`: **Não usa mais Chart.js**. A função `renderizarGraficoRanking()` foi reescrita para gerar cards/lista em HTML puro, injetados no DOM (`#lista-ranking`). Se você precisar ajustar o ranking, modifique a string template HTML na função, e não as configurações do Chart.js.
- **Service worker is network-first, not cache-first** (`CACHE_NAME` currently `"energycalc-v2"`).
  It was cache-first originally (`v1`) and that was a real bug: once a page entered the cache it
  never got re-fetched from disk even after the source changed, since cache-first doesn't hit the
  network at all if an entry exists. Bump `CACHE_NAME` on any change that must reach already-visited
  users promptly — `skipWaiting()` + `clients.claim()` mean it self-heals within 1–2 reloads once
  bumped, but a user with a *very* stale cache from before this fix may still need one manual
  hard-refresh/unregister to clear it.
- **`Number("") === 0`, not `NaN`** — a recurring footgun with optional numeric `<select>`/`<input>`
  fields (e.g. an empty residência selector). Always check the raw string is non-empty *before*
  calling `Number()` on it if `0` would be a falsy-but-valid ID; see `aparelhos.js`/
  `novo_aparelho.js`'s `residenciaId` checks for the pattern.

## Current state / open items

- **A misleading "CORS error" can mean a plain 500, not a real CORS problem.** The backend's
  catch-all exception handler is registered for the base `Exception` class, which Starlette routes
  through `ServerErrorMiddleware` — a layer *outside* `CORSMiddleware` — so any unhandled backend
  exception used to reach the browser with no CORS headers at all, and Chrome reports that as
  "blocked by CORS policy" instead of surfacing the real 500. This was fixed backend-side
  (`../backend/app/core/error_tracking.py` now attaches CORS headers manually when a configured
  origin is present), but if a *new* "CORS error" shows up during frontend work, reproduce the exact
  request with `curl`/`urllib` first before assuming the CORS config is wrong — it's very likely a
  server-side exception, not an origins misconfiguration.
- **Deleting a Residência that has Aparelhos currently 500s** — no `ON DELETE CASCADE`/`SET NULL`
  exists on that particular FK chain yet (unlike Aparelho→RegistroConsumo/Recomendação, which was
  fixed). Flagged to the user, not yet resolved: needs a product decision (cascade the delete vs.
  block it with a clear message, mirroring how Aparelho-delete is blocked for FREE) before fixing.
- Super Admin panel (`../DESIGN-DESKTOP.MD`) not started — explicitly deferred to a separate pass.
- Stripe checkout, real SMTP, and Google OAuth are all still unconfigured in `backend/.env` — the
  frontend already degrades gracefully for all three (clear toasts/503 messages), nothing to fix
  here, just don't expect `Assinar Premium`, e-mail links, or the Google button to fully work
  end-to-end in this environment yet.
- No automated frontend tests exist. Verification has meant real Playwright runs against both dev
  servers each time — screenshots for anything visual, full request/response/console capture for
  anything behavioral.
