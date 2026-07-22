# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PWA frontend for **EnergyCalc** — the user-facing app (landing, auth, dashboard, appliance
registry, simulator, goals, recommendations, subscription) for the Freemium electricity
consumption calculator. Built against the FastAPI backend in `../api.energycalc.com.br/backend` (see
`../api.energycalc.com.br/backend/CLAUDE.md` for the API side). This is **not** the Super Admin panel —
`../DESIGN-DESKTOP.MD` describes that, and it hasn't been built yet (explicit separate pass).

**Three deliberate, locked-in decisions** (asked of the user before building, don't relitigate):
1. **PHP serves static files only — no templating, no server-side logic.** `router.php` just
   resolves an extension-less URL (`/dashboard`) to its `.html` file on disk; every page is plain
   HTML/CSS/JS. Swappable for any static host later without touching a single page. (A dynamic,
   per-request `/js/config.js` generation was tried and fully working in both `php -S` and Apache,
   but the user chose to revert to a plain static `js/config.js` instead — see that Architecture
   bullet for the tradeoff this brings back.)
2. **MPA, not SPA.** Every screen is its own `.html` file with its own `<script>` bootstrap line
   at the bottom — no client-side router, no framework, no build step. Chosen because it pairs
   naturally with "PHP is just a static server" and makes the service worker's job trivial (cache
   discrete files, not app shell + hydration).
3. Design is translated 1:1 from `../DESIGN-APP.MD` (mobile-first) — its YAML frontmatter tokens
   became `css/tokens.css` custom properties verbatim. `../DESIGN-DESKTOP.MD` is out of scope here.

## Commands

There's no build step. Two ways to serve the frontend, both work against the same `router.php` —
pick whichever matches how you're testing:

```bash
# Option A: PHP's built-in dev server (simplest, matches the original design)
# from this project's own root, energycalc.com.br/ (relative paths in router.php
# require this exact cwd — there's no frontend/app/ nesting, this repo root IS
# the webroot)
php -S localhost:8080 router.php

# Option B: Apache/XAMPP, project placed under htdocs (e.g. htdocs/energycalc.com.br/)
# needs .htaccess alongside router.php, i.e. at this same repo root (mod_rewrite +
# AllowOverride All, both already on in a stock XAMPP install) — without it,
# Apache 404s every extension-less URL instead of routing it through router.php.

# Backend is a separate sibling project — ../api.energycalc.com.br/backend/
# (not a subfolder of this repo; see ../api.energycalc.com.br/backend/CLAUDE.md)
cd ../api.energycalc.com.br/backend && python run.py
```

Then open `http://localhost:8080` (option A) or wherever the Apache vhost/htdocs subfolder maps to
(option B — e.g. `http://localhost/energycalc.com.br/`). `js/config.js` is a real static file again
(see Architecture) — edit it by hand if `BASE_URL`/`API_BASE` need to change for your environment.
**Whichever origin you actually browse from must be in `CORS_ORIGINS` in
`../api.energycalc.com.br/backend/.env`** — `http://localhost:8080` (option A) and `http://localhost`
(option B, Apache's default port 80) are different origins to the backend and need separate entries;
the backend only reads `CORS_ORIGINS` at startup, so it needs a restart after editing `.env`, not
just a file save.

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
  historico.html, metas.html, recomendacoes.html, insights.html, assinatura.html,
  perfil.html                                                       → authenticated (call exigirLogin())
  router.php            → extension-less URL → static .html resolver, subfolder-aware (see below)
  .htaccess             → only needed for Apache/XAMPP serving, not `php -S` — routes everything
                             through router.php, see Commands
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
  js/config.js            → BASE_URL/API_BASE constants, hand-edited (see below) — must load before
                             every other script
  js/api.js               → fetch wrapper, reads API_BASE (from js/config.js), 401 handling
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
- **`js/config.js` is a plain static file with hand-edited `BASE_URL`/`API_BASE` constants** — a
  fully-working dynamic alternative (generated per-request by `router.php` from `$_SERVER['HTTP_HOST']`,
  zero manual editing needed across dev/LAN-IP/production) was built and verified working end-to-end
  in this same session, but the user explicitly chose to revert to the static file — **the original
  drift-out-of-sync problem this was meant to solve is back on purpose**: `js/api.js`'s old comment
  about `API_BASE` needing hand-updates when the backend's host/port changes applies again. If this
  bites again, the dynamic version is a known-working, already-debugged reference to reach for
  (its two hard-won lessons if rebuilding it: `$_SERVER['SCRIPT_NAME']`/`PHP_SELF` are *not* reliable
  for detecting what subfolder `router.php` itself is running from under PHP's built-in dev server —
  it populates them with whatever file it internally resolved for the *requested* URL instead, e.g.
  `/index.html` for a request to `/dashboard` — compare `__DIR__` against `$_SERVER['DOCUMENT_ROOT']`
  instead; and PHP's `dirname()` on Windows can return `\` rather than `/`, so normalize separators
  before using it in a URL).
  - Every HTML page's `<script>` list loads `js/config.js` immediately before `js/api.js` (classic
    scripts share one global scope, so this ordering is what makes `API_BASE` visible to `api.js`
    without any module system). `service-worker.js`'s precache list includes it too.
  - `router.php` still auto-detects being served from a subfolder (not just webroot) — this project
    can be, and in at least one real dev setup is, served from `htdocs/<name>/` under Apache/XAMPP
    instead of `php -S`'s webroot — using the `__DIR__`-vs-`DOCUMENT_ROOT` comparison above, so
    extension-less URLs and static files both resolve correctly either way. Needs
    `frontend/app/.htaccess` alongside it for Apache (see Commands) — without that file, Apache
    never routes anything to `router.php` in the first place, subfolder-aware or not. This part
    was kept; only the `/js/config.js`-specific generation was reverted.
  - `js/api.js`: `apiGet`/`apiPost`/`apiDelete` all funnel through `apiRequest()`, which attaches
    `Authorization: Bearer <token>` from `localStorage`, unwraps the backend's
    `{"detail": {"erro": ..., "mensagem": ...}}` error shape into an `ApiError` (`.message`, `.erro`),
    and on `401` (or a network failure) clears the token and redirects to `login`.
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
  `../api.energycalc.com.br/backend/CLAUDE.md`) and submits that as a normal `potencia_watts`, so every downstream feature
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
- **Service worker is network-first, not cache-first** (`CACHE_NAME` currently `"energycalc-v3"`).
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
  (`../api.energycalc.com.br/backend/app/core/error_tracking.py` now attaches CORS headers manually when a configured
  origin is present), but if a *new* "CORS error" shows up during frontend work, reproduce the exact
  request with `curl`/`urllib` first before assuming the CORS config is wrong — it's very likely a
  server-side exception, not an origins misconfiguration.
- **Resolved**: deleting a Residência that had Aparelhos used to 500 (no `ON DELETE` on that FK).
  User chose blocking with a clear message over cascading; Tarifa (which has no delete endpoint of
  its own) is cascaded at the application level instead of blocked, since blocking there would've
  been a permanent dead end. See `../api.energycalc.com.br/backend/CLAUDE.md` for the full reasoning.
- **Open item**: `js/config.js`'s `BASE_URL`/`API_BASE` are hardcoded for the current dev setup
  (`http://localhost/energycalc.com.br` / `http://127.0.0.1:8002`) — edit this file by hand for any
  other environment (different LAN IP, production). This was a deliberate, informed choice (see the
  Architecture bullet), not an oversight — don't "fix" it back to the dynamic version without asking.
- **Open item**: `../api.energycalc.com.br/backend/.env`'s `CORS_ORIGINS` was extended to include bare `http://localhost`
  (port 80, i.e. Apache/XAMPP without `php -S`) alongside the existing `http://localhost:8080` — but
  the backend only reads `.env` at process startup, so whichever backend is currently running needs
  an actual restart before that new origin works; a login attempt from `http://localhost` against a
  not-yet-restarted backend fails with a CORS error in the browser console (preflight rejected, no
  `Access-Control-Allow-Origin`) that looks unrelated to `.env` at a glance.
- **Resolved**: `GET /dashboard/` 500'd (`UndefinedColumn: faturas.uc`) because the live Neon
  `faturas` table was missing 15 columns the `Fatura` SQLAlchemy model had grown (`uc`,
  `codigo_cliente`, `bandeira`, `tarifa_te`, etc. — see `../api.energycalc.com.br/backend/CLAUDE.md`'s matching bullet).
  Same root cause as that doc's FK-`ondelete` drift bullet: `create_tables.py`'s `create_all`
  doesn't alter existing tables. Fixed with 15 manual `ALTER TABLE faturas ADD COLUMN` statements
  against Neon (all nullable, additive).
- **Resolved**: `js/paginas/dashboard.js` had a real syntax error (escaped backticks/`${` —
  `` \` `` / `\$` — instead of real ones, in the ranking-item template literal around line 236-252,
  apparently a copy-paste artifact) that broke the entire file — nothing in it could run, including
  `inicializarDashboard`. Found via a console-error check while verifying an unrelated change; fixed
  by removing the stray backslashes. Worth a second look if any *other* page's `.js` was edited via
  the same route as that one was — this class of corruption wouldn't necessarily throw until the
  affected function actually runs.
- **Resolved**: invoice upload (`enviar_fatura.html`/`js/paginas/enviar_fatura.js`) now extracts the
  full ~25-field `Fatura` shape (UC, código cliente, bandeira tarifária, tarifas/valores TE/TUSD,
  CIP, juros, ICMS/PIS/COFINS, leituras de medidor, datas...) via regex over PDF.js-extracted text,
  not just the original 4 basic fields (mes/ano/consumo/valor) — **deliberately no AI/Gemini**, per
  explicit user decision. `parseDadosFaturaTexto()` in `enviar_fatura.js` mirrors the exact same
  regex set as the backend's `fatura_parser_service.py` (see `../api.energycalc.com.br/backend/CLAUDE.md` for the full
  field-by-field breakdown); both were calibrated and verified byte-for-byte identical (25/25 fields)
  against a real Enel Ceará bill before being committed — if you change one side's regex, change the
  other too, they're meant to stay in lockstep.
  - `enviar_fatura.js`'s PDF.js text reconstruction (`reconstruirTextoPdf`) had to be rewritten from
    a naive `items.map(i => i.str).join(" ")` — that inserted spurious spaces inside accented words
    (`"MONOFÁSICO"` → `"MONOF Á SICO"`, breaking every regex anchor containing one) because PDF.js
    doesn't emit text items in left-to-right visual order and splits accented glyphs into their own
    item with no real gap before them. The fix groups items into lines by Y-coordinate, sorts each
    line by X, and only inserts a space where the gap between items exceeds ~1.5pt.
  - `normalizarNumero()` used to strip every `.` unconditionally (assuming Brazilian
    comma-decimal, `"0,02455"`) — meter-reading fields on real bills use a literal `.` decimal
    already (`"17202.0"`), which that old logic would have mangled into `172020`. Now only strips
    `.` when a `,` is also present.
  - The browser-side extraction, when it succeeds, still short-circuits the backend's own extraction
    (sends `parsed_payload` instead of just the raw file) — this was true before this change too and
    wasn't revisited, so a bill the client can't fully parse still falls through to the backend's
    (equally comprehensive, as of this change) `fatura_parser_service.py`.
  - Calibrated only against one real bill (Enel Ceará, the federal "Documento Auxiliar da Nota
    Fiscal de Energia Elétrica Eletrônica" template) — the required 4 fields
    (mes/ano/consumo/valor_total) fail clearly with a 422 if a differently-laid-out bill (e.g.
    Equatorial, the other concessionária option in this same page's UI) doesn't match; the other
    ~21 fields are individually best-effort and silently `None` if their specific anchor text
    doesn't appear. Untested against Equatorial — flag if that concessionária's bills turn out to
    need their own regex set.
- **Resolved**: re-uploading a bill for a residência/mês/ano that already has a saved `Fatura` had a
  real bug where a *worse* re-extraction (e.g. a partial `parsed_payload`) would null out richer
  data an earlier upload had already saved — `fatura_router.py`'s update path unconditionally
  overwrote every optional field with whatever the new extraction produced, including `None`. Fixed
  to only overwrite fields the new extraction actually found a value for. Verified over real HTTP:
  re-uploading the same bill updates the existing row in place (same `id`), and a deliberately
  partial follow-up upload leaves the previously extracted fields intact.
- **Resolved**: `historico.html`'s "Status das Faturas" card (`#resumo-status`) had a **hardcoded
  `"92% Analisadas"` baked into the HTML** that `historico.js` never touched — it stayed on screen
  permanently regardless of the user's actual data, including for a brand-new account with zero
  faturas. Wired it to something real: `% dos meses no histórico com `origem === "real"`` (an
  uploaded/analyzed bill) vs. `"simulada"` (calculated-only, no bill uploaded for that month) — the
  same `origem` field the per-item "Fatura Real"/"Estimativa (Simulada)" badges already use, just
  aggregated. Also changed the HTML's static fallback from the fake `92%` to `--%`, matching the
  `---`/`R$ ---` placeholder style the other two summary cards already use before `historico.js`
  populates them (and correctly what stays on screen for the empty-history case, which returns
  before reaching any of the `resumo-*` updates).
  - **Found while testing this, unrelated to the card itself**: `GET /dashboard/energia/historico`
    (and `GET /dashboard/`) 500'd for exactly the realistic case this card is meant to describe — a
    month with only calculated consumption (Aparelho registered, no bill uploaded). Real backend
    bug, not a frontend issue — see `../api.energycalc.com.br/backend/CLAUDE.md`'s `agregados_reais_e_simulados` bullet
    (missing `aliquota_cofins = None` in the "simulada" branch) for the fix. Worth knowing if this
    card ever shows stale `--%` again: check the browser console/network tab for a 500 on
    `/dashboard/energia/historico` before assuming it's the card's own logic.
- **Resolved**: `historico.html`'s fatura cards were showing all ~20 extracted fields unconditionally
  (UC, tarifas, impostos, leituras...) — very tall, and mostly blank/`"—"`/`R$ 0,00` for `"simulada"`
  months that have none of that data. `js/paginas/historico.js`'s card template now shows only
  consumo/valor/tarifa/badge by default, with the rest behind a "Ver detalhes" toggle
  (`alternarDetalhesFatura()`, CSS-grid `0fr → 1fr` collapse animation in `componentes.css`) that
  **only renders for `origem === "real"` items** — a simulated month has nothing in those extra
  fields to show, so no toggle button appears for it at all. Also fixed doubled spacing on
  `.card-historico-item` (`gap` on the flex container *and* `margin-bottom` on each child were both
  applied — same 16px counted twice) and removed a `min-height: 240px` that kept cards artificially
  tall even after compacting.
  - `uc`/`codigo_cliente` inside the expanded details are masked (`••••••••`) by default with a
    per-field eye-icon toggle (`campoMascaradoHtml()`/`alternarDadoSensivel()`) — the real value only
    ever lives in a `data-valor` attribute until the user clicks to reveal it, and each field's
    reveal state is independent (revealing UC doesn't reveal Cliente).
  - All 16 technical field labels in the expanded details (UC, Cliente, Referência, Vencimento,
    Bandeira ×2 — see below, Dias Faturados, Classe, Subclasse, Tarifa TE, Tarifa TUSD, Média/kWh,
    ICMS, PIS, COFINS, Juros) got a small (i) info button next to the label
    (`campoComInfoHtml()`/`alternarInfoCampo()`) that reveals a one-line plain-language explanation
    inline, below the label, on click — **deliberately not a floating tooltip/popover**: the "Ver
    detalhes" panel needs `overflow: hidden` on its inner div for the collapse animation (see above),
    which would clip anything absolutely-positioned outside the panel's bounds, so the explanation
    has to stay in normal document flow instead. Each field's info toggle is independent, same as the
    masking toggle. Note there are two different fields both labeled `"Bandeira"` in the UI (one
    shows the flag color/name like `"Amarela"`, the other the R$ surcharge it added to the bill) —
    pre-existing, not something this pass renamed, but their info text at least now disambiguates
    which is which.
  - Both verified via a headless DOM simulation (jsdom) driving the real `historico.js` file against
    realistic API responses — no live browser available in this environment, so this is the
    verification method going forward for this file's rendering logic: load the actual file into a
    `jsdom` window, mock `apiGet`, assert on the resulting DOM (element counts, classes, text,
    `aria-*` attributes) rather than reasoning about the template string by eye.
- **Resolved**: explored how `Fatura` data (see `../api.energycalc.com.br/backend/CLAUDE.md`) could integrate with
  `Aparelho`/dashboard data beyond just `historico.html`'s per-item badges — found and fixed several
  gaps, all now live on `dashboard.html` and `metas.html`:
  - **New**: `DashboardEnergiaRepository.cards()` gained `cobertura_aparelhos_percentual` — when the
    current month has a real Fatura *and* at least one Aparelho with a `RegistroConsumo` for that
    same month, it's `round(sum(RegistroConsumo.consumo_mensal_kwh) / fatura.consumo_kwh * 100, 1)`;
    otherwise `None` (nothing meaningful to compare). Surfaced as a dynamic insight on
    `dashboard.html` (`preencherInsightCobertura()` in `dashboard.js`) with three tiers of wording —
    85–115% ("boa precisão"), <85% ("pode haver equipamentos não cadastrados"), >115% ("você os usa
    menos horas do que configurado") — **replacing a fully hardcoded, fabricated insight-card**
    (`"Seu consumo é 15% menor que a média regional..."` — no such regional-average data source
    exists anywhere in this codebase). Tested against real data mid-session: one account's 4
    registered Aparelhos projected 384% of what that month's real Fatura actually billed — a
    genuinely useful signal (configured hours/power don't match real usage), not a hypothetical.
  - **New**: `cards()` also now returns `vencimento` (the real Fatura's due date when
    `origem_mes_atual === "real"`, else `None`) — the "Custo Est." card's "Vencimento: 12 Out" line
    was **hardcoded text**, not derived from any date; it's now hidden entirely in simulated-only
    months instead of showing a fake date.
  - **Fixed two more fabricated values in `dashboard.js`**: the "Consumo Mensal" card's trend
    (`txt-tendencia`) was hardcoded `"-12%"` regardless of actual data — now computed from the last
    two entries of `evolucao_mensal` (hidden entirely with under 2 months of history, since there's
    nothing to compare); consumption *increasing* now shows red/up-arrow, decreasing shows
    green/down-arrow (inverted from a typical financial "up is good" metric — for energy use, up is
    bad). The "Meta Mensal" bar's `metaTotal = 500` was **hardcoded** too — now fetches
    `GET /metas/minha-meta` (pre-existing endpoint, see `meta_router.py`) and uses its real
    `teto_kwh`/`projecao_mensal_kwh`; shows "Sem meta cadastrada" instead of a fake 500 kWh ceiling
    when the user hasn't set one, and the bar turns red past 100%.
  - **New**: `"Fatura real"`/`"Estimado"` badges (reusing `historico.js`'s existing
    `.badge-status-analisada`/`.badge-status-processamento` classes for visual consistency) now
    appear on the "Consumo Mensal" card (from `cards.origem_mes_atual`) and as a permanent
    `"Estimado (aparelhos)"` caption on the "Por Categoria" and "Ranking de Aparelhos" sections —
    those two **always** show `RegistroConsumo`-calculated data even in months with a real Fatura
    (a bill has no per-Aparelho/per-categoria breakdown to reconcile against, see
    `../api.energycalc.com.br/backend/CLAUDE.md`'s "what can't be reconciled" bullet), so without the caption the numbers
    there can silently disagree with the real total shown just above with no explanation why.
  - **New**: `metas.js::renderizarMeta()` now shows the same real/estimado badge for each goal's
    projection, using `projecao.origem` — the backend (`meta_router.py::_calcular_projecao`) already
    computed and returned this field; the frontend just never displayed it before.
  - All four verified via jsdom against the real `dashboard.js`/`metas.js` files with constructed
    inputs covering every branch (real vs. simulada, coverage above/below/within the "good" band,
    trend up/down/insufficient-history, goal set/unset/exceeded) — see the historico.js bullet above
    for why jsdom is the verification method here instead of a live browser.
- **`enviar_fatura.html`'s "Analisar Fatura" button now opens a blocking progress modal
  (`#modal-progresso-fatura`) instead of just swapping the button into a spinner via the generic
  `comCarregamento()` helper** — spinner → "Enviando para o servidor..." → "Analisando dados da
  fatura..." → checkmark "Fatura enviada!" (each with its own icon state), then redirects to
  `historico`. Deliberately **no X button and no backdrop-click-to-dismiss** (the overlay has no
  click listener attached, unlike `confirmarExclusao`'s modal which opts into one) — the only way
  out while it's running is the explicit "Cancelar" button, matching what was asked: the action
  can't be dismissed by accident, but can be deliberately aborted.
  - "Cancelar" (`cancelarEnvioFatura()`) calls `AbortController.abort()` on the in-flight
    `fetch('/faturas/upload')` — a **real** cancellation of the network request, not just hiding the
    modal while the upload keeps running invisibly. `enviar_fatura.js` creates a fresh
    `AbortController` right before the `fetch` call and passes `signal` in the request options;
    catching `rede.name === "AbortError"` in the existing network-error `catch` block distinguishes
    "user cancelled" (silent — `cancelarEnvioFatura()` already showed its own toast and closed the
    modal) from a real connectivity failure (which still shows the offline banner and redirects to
    login, unchanged from before).
  - A module-level `canceladoEnvioFatura` flag guards every subsequent UI update
    (`atualizarEtapaEnvioFatura()`, `mostrarSucessoEnvioFatura()`) against a narrow race: the local
    PDF.js text extraction that can run before the `fetch` even starts isn't itself abortable (no
    cancellation API for that library), so a cancel click during that phase has to be remembered and
    checked once extraction finishes, rather than relying on the (not-yet-existent) `AbortController`
    alone.
  - Verified with jsdom against the real `enviar_fatura.js`, mocking `fetch` to control timing
    directly: (1) success path — modal shows each stage in order, ends on the checkmark; (2) cancel
    mid-request — asserted `signal.aborted` actually flips to `true` (not just that the modal closed)
    and that exactly one toast fires (`"Envio cancelado."`), not a second spurious error toast from
    the resulting `AbortError` rejection; (3) server-error path — modal closes, real backend error
    message shown; (4) no-file-selected path — modal never opens at all.
- **`index.html` (the public landing page) had zero desktop-specific CSS** — confirmed by grepping
  `componentes.css`/`layout.css` for `@media`: only 4 blocks existed in the whole project before this
  pass, none touching any landing section. `.container`/`.nav-publica` are hardcoded
  `max-width: 720px` with no override anywhere, so on any viewport wider than a tablet the entire
  landing page rendered as a narrow mobile-width column floating in the middle of the browser window
  — hero stacked, benefit cards in a single vertical list, pricing cards stacked, testimonials in a
  horizontal-scroll strip. **Not** the same issue as the rest of the app: every authenticated page
  (dashboard, aparelhos, historico...) is deliberately capped at 720px as a locked-in mobile-first
  decision (see the top of this file) and that's correctly untouched — the landing page is the one
  surface a visitor is likely to hit on a real desktop browser before ever deciding to use the app,
  so it's the one place this gap actually mattered.
  - Added one `@media (min-width: 640px)` and one `@media (min-width: 1024px)` block, both scoped
    to landing-exclusive selectors (`.pagina.publica .container`, `.nav-publica`, `.hero-publica`,
    `.grid-beneficios`, `.grid-planos`, `.depoimentos-scroll`, `.passos-lista`, `.faq-lista`) —
    confirmed via grep that none of these class names or `.pagina.publica`/`.nav-publica` appear on
    any other page (`carregarLayoutPublico()`, which injects `.nav-publica`, is only ever called
    from `index.html`), so none of this can leak into the authenticated app's mobile-first pages.
    `.container`/`.nav-publica` widen to `1100px` only ≥1024px; below that they're still the
    original `720px`, unchanged.
  - Hero goes from stacked (mockup, then headline/subtitle/CTA) to a 2-column grid at ≥1024px
    (mockup right, text left, via `order` — not by reordering the HTML, so mobile reading order is
    untouched). Required wrapping the headline/subtitle/CTA in a new `.hero-texto` div (previously 3
    separate siblings of `.hero-mockup` inside `.hero-publica .container`) so the grid has exactly
    two items to place; also moved the `text-align: center` those elements got from the `texto-centro`
    utility class into `.hero-titulo`/`.hero-subtitulo`'s own CSS instead (so it can flip to `left`
    at the desktop breakpoint without fighting the utility class's specificity), and gave the CTA a
    dedicated `.hero-cta` class instead of the shared `.btn-block` utility (so its width can go
    `auto` on desktop without touching `.btn-block` itself, which plenty of other pages rely on
    staying full-width).
  - Benefícios/Planos: new `.grid-beneficios`/`.grid-planos` wrapper classes (replacing the inline
    `flex-col gap-md` utility classes those two `<div>`s had) — stay a stacked column by default,
    become `repeat(auto-fit, minmax(240px, 1fr))` grids at ≥640px. Benefícios additionally forces
    exactly 3 columns at ≥1024px rather than leaving the column count to `auto-fit` — deliberate,
    since there are always exactly 3 benefit cards and a fixed count reads more intentional than a
    fuzzy one. **Ordering gotcha, already hit and fixed once**: the ≥640px and ≥1024px blocks both
    style `.grid-beneficios` at identical specificity, so whichever block comes *later in the file*
    wins for viewports where both conditions are true (any desktop width is ≥640px *and* ≥1024px
    simultaneously) — had these backwards initially (1024px block written first), which would have
    silently made the desktop 3-column rule always lose to the tablet auto-fit rule. Fixed by
    ordering mobile-first (smaller `min-width` first) like the rest of the cascade already assumes.
  - Depoimentos switches from `overflow-x: auto` horizontal scroll to a static
    `repeat(auto-fit, minmax(260px, 1fr))` grid at ≥1024px (scroll-snap is a mobile affordance;
    desktop visitors don't expect to have to scroll sideways to read three short testimonials that
    would otherwise fit on screen at once).
  - Passos ("Como funciona") and FAQ stay single-column/vertical even on desktop (a numbered
    step-with-connecting-line layout and an accordion don't gain anything from going horizontal) but
    get `max-width: 640px; margin: 0 auto` at ≥1024px so they don't stretch into unreadably-wide
    lines inside the newly-widened 1100px container — same treatment for the final CTA section's
    text. Plain prose readability, not a grid change.
  - Added a subtle `translateY(-4px)` + shadow hover lift to `.feature-card`/`.plano-card`/
    `.depoimento-card`, gated behind `@media (hover: hover)` specifically so it can't get "stuck" on
    touch devices (a tap registers as hover-then-never-unhover on touchscreens without that guard).
  - **Caveat, stated plainly**: none of this was verified in an actual browser — there's no
    screenshot/browser-automation tool available in this environment. Verification here means: CSS
    brace-balance checked programmatically, cascade/specificity reasoned through by hand (and one
    real bug caught that way, see the ordering gotcha above), and DOM structure checked with jsdom
    (right element counts, right classes, new classes confirmed absent from every other page). None
    of that confirms the page actually *looks* good at any given width — a real render is still owed
    before calling this done. Ask for a screenshot or open it in a real browser before assuming the
    visual result matches what's described here.
- **New**: `politica-cookies.html` — a real, product-accurate cookie policy, not boilerplate. Written
  after actually auditing what sets cookies in this codebase (`grep`'d for `set_cookie`/
  `document.cookie` across the whole repo, not assumed): **the product itself sets zero cookies** —
  `js/auth.js` keeps the JWT in `localStorage`, confirmed throughout this codebase already. The one
  real `Set-Cookie` anywhere is `status_db_session` (`../api.energycalc.com.br/backend/app/api/v1/status_router.py`, `HttpOnly`,
  12h expiry) — session auth for the password-gated internal `/status/db` metrics page, not part of
  the product a normal user ever reaches. Also documents the third-party resources that load and
  could set their own cookies per *their* policies, not ours: Google Fonts (loaded on every page via
  `css/base.css`'s `@import`, though current Google Fonts serving doesn't itself set cookies), Google
  Sign-In (`accounts.google.com/gsi/client`, only loads when `GOOGLE_CLIENT_ID` is actually configured
  — see `js/auth.js`'s already-documented empty-string fallback; currently never loads in this dev
  setup, but the policy describes the product's capability, not this deployment's current flags), and
  Stripe (never embedded in-page — subscribing redirects to Stripe's own hosted checkout, so any
  Stripe cookies live on Stripe's domain, governed by Stripe's policy).
  - Reused the existing `.pagina.publica`/`nav-publico` shell (same as `index.html`) rather than the
    narrow `.tela-auth` card shell `login.html`/`cadastro.html` use — a multi-section legal document
    reads better in the wider content layout than squeezed into an auth-form-width card.
  - `login.html`/`cadastro.html` already had a `footer.auth-rodape` with **three dead placeholder
    links** (`href="#"` for Política de Privacidade / Termos de Serviço / Central de Ajuda) — none of
    those documents exist yet and weren't in scope here, left untouched. Added a fourth, *real* link
    to the new cookie policy alongside them. `index.html` had no footer at all before this.
  - **First attempt reused `.auth-rodape` on `index.html` too (just the one link, no other content)
    and it looked broken** — a single caption-sized link sitting with no top spacing directly under
    `.cta-final`'s solid green block reads as an orphaned afterthought, not a footer (confirmed by
    screenshot, since there's no browser available in this environment to have caught it beforehand).
    Replaced with a dedicated `.rodape-landing` — its own banded section (`border-top` +
    `surface-container-low` background to visually separate it from the CTA above), a small brand
    mark (icon + "EnergyCalc") so the link doesn't sit alone, and a `© 2026 EnergyCalc` line for
    real content weight, all centered with proper vertical spacing between the three pieces.
    `.auth-rodape` on `login.html`/`cadastro.html` is untouched — it reads fine in that narrower
    auth-card context, this was specifically an `index.html` problem, not a shared-component one.
  - **The contact address (`privacidade@energycalc.com`) is a placeholder** — chosen because it's the
    project's own domain (not an invented external service), but no mailbox exists behind it yet
    (confirmed: `SMTP_FROM` is empty in `../api.energycalc.com.br/backend/.env`, the only real `@energycalc.com` address
    anywhere is the seeded super-admin login `admin@energycalc.com`, not a support inbox). Needs a
    real mailbox — or a different real contact method — before this page is actually live for users.
  - Verified over real HTTP against the running Apache server (`/politica-cookies` → 200, correct
    content — `router.php` needs no per-page registration, any `<name>.html` on disk is automatically
    reachable at `/<name>`) and structurally with jsdom (right elements present, footer links land on
    the right href, the two untouched placeholder links on login/cadastro are still exactly `href="#"`
    and unchanged).
- **New**: a real cookie-consent modal (`js/ui.js`'s `inicializarBannerCookies()`/`HTML_MODAL_COOKIES`),
  reusing the exact same `.modal-overlay`/`.modal.modal-confirmar` markup `confirmarExclusao()` already
  uses for visual consistency. Single "Entendi" button, no "Aceitar/Rejeitar" pair — deliberate, since
  per the `politica-cookies.html` bullet above the product doesn't actually set any optional/marketing
  cookie for a "reject" choice to meaningfully turn off; presenting a fake binary choice would've been
  less honest than what's actually happening technically. Also dismisses on backdrop click (not just
  the button) since there's nothing being "confirmed" here that warrants forcing an explicit click.
  - **Runs automatically the moment `js/ui.js` loads — no page calls it.** Every other function in
    this file is a library function some page explicitly invokes; this one breaks that convention on
    purpose. Confirmed via `grep -l 'js/ui.js' *.html` that all 19 top-level `.html` pages already load
    this script, so hooking the auto-show there guarantees the banner reaches every page with zero
    per-page edits and — more importantly for something with compliance implications — zero chance of
    silently missing a page the way editing 19 files by hand risks.
  - Consent is remembered in `localStorage` (key `cookies_ok`), not a cookie — using a cookie to
    remember "don't show the cookie notice again" would be circular, and would also mean clearing
    cookies (a very plausible thing for someone to do specifically because of a cookie notice) makes
    the notice reappear as if nothing was ever acknowledged.
  - Verified with jsdom driving the real `ui.js`: modal auto-appears on a fresh `localStorage`, stays
    hidden on a simulated repeat visit (`cookies_ok` pre-set), "Entendi" and backdrop-click both
    dismiss-and-remember, and a click *inside* the modal card (not the backdrop) correctly does
    nothing — confirmed the click-outside-only-on-backdrop logic isn't accidentally matching clicks
    on the card itself.
  - **Bug caught and fixed while building this**: `.modal-confirmar-icone` (the round icon slot
    the cookie modal, and the onboarding modal below, both reuse from `confirmarExclusao`'s markup)
    defaults to a **red** `error-container`/`error` background — correct for its original
    delete-confirmation use, silently wrong for anything else that reuses the same class without an
    override. The cookie modal had exactly this bug (red icon on a neutral informational notice)
    until caught here. Added `.icone-neutro`/`.icone-positivo` modifier classes; **any future modal
    that reuses `.modal-confirmar-icone` needs one of these (or a new variant), it does not default
    to anything neutral.**
- **New**: a first-run onboarding modal on `dashboard.html` (`js/paginas/dashboard.js`'s
  `verificarOnboarding()`) for accounts with **zero Residências** — fetches `GET /residencias/`
  alongside the dashboard's other `Promise.all` calls and shows a welcome modal (reusing the same
  `.modal-confirmar` markup as the cookie-consent and delete-confirm modals, `.icone-positivo`
  variant) listing the 3 steps that actually unblock the rest of the app: cadastrar residência →
  definir tarifa → cadastrar aparelhos, with a primary CTA straight to `residencias.html` (where
  both the residência form and the tarifa modal already live on one page) and a secondary "Agora
  não" that just closes it for that page view.
  - **Deliberately reappears on every dashboard visit for as long as `/residencias/` stays empty** —
    unlike the cookie modal, there's no `localStorage` "don't show again" flag. Dismissing with
    "Agora não" doesn't fix the underlying problem (a residência is a hard prerequisite for
    Aparelho/Tarifa/Meta, all take `residencia_id`), so the reminder staying live until the user
    actually acts is the correct behavior here, not a bug to dedupe.
  - Fails closed on error: if `GET /residencias/` itself fails (network blip, cold-start timeout),
    `verificarOnboarding()` gets `null` and shows nothing rather than risk popping the "you're new
    here" modal in front of a user who actually has residências already — a false negative (modal
    that should've shown but didn't) is low-cost, a false positive here would look broken.
  - Verified with jsdom against the real `dashboard.js`: shows for `[]`, stays hidden for a non-empty
    residências array, stays hidden when the residências fetch itself rejects, "Agora não" and
    backdrop-click both dismiss, click inside the card doesn't. Also re-verified against the real
    backend with a genuinely fresh `POST /auth/register` account (not a mocked response) that
    `GET /residencias/` really does come back `[]` for a brand-new user — the lesson from the
    `meta_router.py` bug earlier in this file (a jsdom pass with a *mocked* response proves the
    frontend does the right thing with a correctly-shaped input, never that the backend actually
    produces one) applied here before calling it done, not after finding a bug the hard way again.
  - **Found mid-verification, unrelated to this feature**: this project got reorganized into two
    sibling projects — the `backend/` that used to live directly under this repo is now
    `../api.energycalc.com.br/backend` (its own project, presumably mirroring a real
    `api.energycalc.com.br` subdomain eventually), confirmed and completed by the user right after.
    A stray `Nova pasta` (an old stale duplicate of this whole frontend, from early in this project's
    history) and a briefly-created empty `frontend/` subfolder are both gone too — this repo's root
    stays the flat structure it already was (every `.html`/`css/`/`js/` directly here, no nesting),
    same as before, just with the backend no longer alongside it. Every reference elsewhere in this
    file that used to point at the old in-repo backend location has been updated to point at
    `../api.energycalc.com.br/backend` instead — if a path still doesn't resolve, that's a sign
    something moved again since this note was written, not that the note itself is wrong.
- **New**: 5 pages that `perfil.html` (and `login.html`/`cadastro.html`'s footer, and now
  `index.html`'s too) already had UI slots for but only ever showed a `mostrarToast('...em breve.')`
  or a dead `href="#"` — `dados-pessoais.html`, `metodos-pagamento.html`, `central-ajuda.html`,
  `termos-uso.html`, `politica-privacidade.html`. Two other "em breve" toasts on `perfil.html`
  (avatar photo upload, the settings gear icon) were **not** touched — different, unrelated
  placeholder features, not part of what was asked here.
  - **`dados-pessoais.html`** (`js/paginas/dados_pessoais.js`) — edit nome/e-mail and change
    password, backed by the two new `../api.energycalc.com.br/backend` endpoints (see that file's
    own CLAUDE.md). Pre-fills from `getUsuarioAtual()` (the locally-decoded JWT, no fetch needed);
    on a successful save, calls `salvarToken()` with the fresh token the backend returns so the
    displayed nome/email stay current without forcing a re-login. Password-change form does its own
    client-side "do the two new-password fields match" check before ever calling the API.
  - **`metodos-pagamento.html`** (`js/paginas/metodos_pagamento.js`) — real payment history (from
    `/assinaturas/minha-assinatura`'s existing `historico_pagamentos`, nothing new needed there) plus
    a "Gerenciar método de pagamento" button that calls the new portal endpoint and redirects to
    Stripe's hosted page. No custom "add card" UI exists or should exist here — see the backend
    note on why. `tratarErroApi` already renders whatever the backend says (the `400`
    "assine o Premium primeiro" for FREE accounts, or a `503` if Stripe isn't configured) without
    needing page-specific error handling.
  - **`central-ajuda.html`** — practical in-app FAQ (how to add your first residência, how the
    consumo/custo formula works, bandeira tarifária, real-Fatura-vs-estimate, Free vs Premium,
    cancellation, password reset, data deletion) — deliberately different content from
    `index.html`'s FAQ, which is marketing-facing. Reuses the exact same `.faq-lista` markup and
    `alternarFaq()` toggle, which **moved from `js/paginas/landing.js` to `js/ui.js`** so both pages
    (and any future one) share one definition instead of `central-ajuda.html` needing its own copy
    or an unrelated `<script src="js/paginas/landing.js">` tag just to get one accordion function.
    Public page (no login required) even though it's linked from the authenticated `perfil.html` —
    a help center should work for someone who hasn't signed up yet too.
  - **`termos-uso.html` / `politica-privacidade.html`** — same spirit as `politica-cookies.html`
    (see that bullet above): real content grounded in what this product actually does and actually
    collects, not generic boilerplate. Privacy policy's data table was written from actually reading
    the `User`/`Residencia`/`Aparelho`/`Fatura`/`Pagamento` models, not guessed — e.g. explicitly
    says card numbers never reach this backend (Stripe-only), and that the Gemini recommendation
    call only ever receives already-computed facts, never raw account data (matches the
    `recomendacao_service.py`/`gemini_service.py` design documented in the backend's own CLAUDE.md).
    Both carry the same kind of disclaimer the cookie policy does: real content, not a substitute
    for an actual lawyer's review before this touches real users.
  - All 5 pages, plus the now-fully-wired footers on `perfil.html`/`login.html`/`cadastro.html`/
    `index.html`, verified with jsdom (right elements, right hrefs, no leftover `href="#"` or
    `em breve` toasts on the 5 migrated items specifically, FAQ accordion still works after the
    `alternarFaq` move) and the two endpoint-backed pages' actual request/response flow driven
    through their real `.js` files against mocked — and, for the backend calls, real — API
    responses. Every new route double-checked live over HTTP (`router.php` needs no registration,
    but worth confirming after adding 5 files at once instead of one).
- **New**: the entire site is now gated to mobile-sized screens only (`js/ui.js`'s
  `verificarDispositivoMovel()`/`HTML_BLOQUEIO_DESKTOP`, `#bloqueio-desktop` in `componentes.css`) —
  explicit user request: no exceptions for the landing page, a full-screen blocking overlay (not a
  banner/toast), detected by screen width. `LARGURA_MAXIMA_MOBILE = 768` (the common tablet
  breakpoint); anything at or under that is let through, anything wider sees only the block screen
  (icon + "Acesse pelo celular" + explanation, no app content, no way to dismiss).
  - Uses `Math.min(window.innerWidth, window.innerHeight)`, not bare `innerWidth` — a phone in
    landscape has an `innerWidth` well past 768, but it's still a phone; taking the smaller of the
    two dimensions means rotating a real mobile device never triggers a false block. Verified this
    specifically: an 844×390 landscape phone viewport correctly stays unblocked
    (`min(844,390)=390 ≤ 768`).
  - Re-evaluates on every `resize` event, not just once at load, so someone who resizes a desktop
    browser window or rotates a device after the page is already open gets re-checked live, in
    either direction (shrinking into the mobile range unblocks; growing back out re-blocks).
  - `z-index: 10000` — deliberately above both `.modal-overlay` (100) and the offline banner (9999,
    `mostrarBannerOffline()`). If a desktop visitor would otherwise see the cookie-consent modal or
    the offline banner, the mobile block wins and covers it; there's nothing useful either of those
    can accomplish on a screen that's about to be told to come back on a phone.
  - **The one modal/overlay in this file with no dismiss path at all** — no X button, no
    backdrop-click-to-close, unlike every other `.modal-overlay` usage in `ui.js`. Deliberate per the
    request: this isn't a dismissable notice, it's meant to fully block use on disallowed screen
    sizes.
  - Auto-runs the moment `js/ui.js` loads (`verificarDispositivoMovel()` is called unconditionally at
    the bottom of the file, plus the `resize` listener), same self-injecting pattern and same
    reasoning as `inicializarBannerCookies()` right above it — confirmed present on all 19 top-level
    `.html` pages already, so hooking it here guarantees site-wide coverage with zero per-page edits
    and zero risk of missing one.
  - **Known, accepted limitation**: screen width is the only signal used (per the user's explicit
    choice of detection method over any user-agent sniffing alternative), so a desktop browser window
    manually resized narrow enough (≤768px wide and tall) reads as "mobile" and is let through — there's
    no way to distinguish that from a real small device using width alone. Confirmed in testing
    (a 700×900 resized-desktop-window case passes as unblocked) and left as-is; revisit with UA-based
    detection only if this specific gap ever turns out to matter in practice.
  - Verified with a jsdom suite driving the real `ui.js` file across iPhone portrait/landscape, iPad
    Mini portrait/landscape (768 is exactly the boundary — confirmed inclusive, i.e. counted as
    mobile), desktop, a small notebook resolution, the narrow-resized-window edge case above, dynamic
    resize in both directions, and repeated-call duplicate-overlay prevention — all passing. One
    harness-only gotcha hit and fixed along the way, not a bug in the shipped code: `JSDOM` instances
    created without a `url` option get an opaque document origin, and jsdom throws a `DOMException`
    the moment *anything* touches `window.localStorage` under that condition (thrown from inside
    jsdom's own `Window.js`, before any app code runs) — fixed by passing `url: "http://localhost/"`
    to the `JSDOM` constructor in the test file. Also confirmed served correctly over real HTTP via
    Apache (`curl` for both `js/ui.js` and `css/componentes.css`, 200 + new content present in both).
- **Resolved**: `dashboard.html`'s "Gastos Mensais" chart (`renderizarGraficoGastos()` in
  `dashboard.js`) technically already received the real Fatura value every month it existed —
  `gastos_mensais` reuses the same `agregados_reais_e_simulados()`-backed `evolucao_mensal()` data
  that prioritizes `Fatura.valor_total` over the calculated estimate — but the chart never surfaced
  it: the Y-axis was hidden (`display: false`, "como no mockup"), there was no tooltip formatting,
  and **11 of 12 bars were `background: transparent`** (only the current month had a visible fill),
  so in practice almost no monthly value was ever actually visible on screen. Fixed without any
  backend change, since the `origem` field per month was already in the response and simply unused:
  - Every bar is now visible and colored by `origem` — solid `COR_AZUL` (`#0051d5`) for a month
    backed by a real Fatura, a lighter `#dae2fd` for a calculated/estimated month — reusing the same
    two-tier real/estimado language as the badges elsewhere (dashboard cards, `historico.js`).
  - Added a tooltip callback: hovering a bar shows `formatarMoeda(custo)` plus "Fatura real" or
    "Estimado", e.g. `"R$ 245,30 — Fatura real"`. The Y-axis stays hidden — that was a deliberate,
    already-commented mockup-fidelity choice, not an oversight, so it wasn't reversed; the tooltip
    is the least invasive way to make the number available on demand without cluttering that look.
  - Added a `legenda-html`/`legenda-item` legend row (same markup pattern "Evolução Mensal" already
    uses) above the chart with the two swatches, since color-coding bars by origem is meaningless
    without a key — new `.bg-azul`/`.bg-azul-claro` classes added next to the existing
    `.bg-primaria`/`.bg-secundaria` in `dashboard.html`'s page-scoped `<style>` block.
  - Verified with jsdom against the real `dashboard.js`, stubbing only the `Chart` constructor
    itself (jsdom has no real `<canvas>` 2D context) to capture the config object — asserts on
    `backgroundColor` per bar and on the tooltip callback's returned string for both a `"real"` and
    a `"simulada"` item, plus the empty-state path and that the legend/CSS/link additions in
    `dashboard.html` are all present and correctly wired. One test-only gotcha hit along the way:
    `Number.prototype.toLocaleString('pt-BR', {style:'currency',...})` inserts a *non-breaking*
    space (` `) after `"R$"`, not a regular one — not a bug, just something the test's own
    assertion string had to match exactly. Also re-confirmed live against the real backend with a
    fresh throwaway test account (residência → tarifa → aparelho) that `GET /dashboard/`'s
    `gastos_mensais` really does come back shaped `{ano, mes, consumo_kwh, custo, origem}` for a
    `"simulada"` month exactly as read from `dashboard_energia_repository.py` — the `"real"` branch
    (`custo` = `Fatura.valor_total`) was confirmed by reading that same already-live-tested code path
    rather than re-uploading a bill, since it's the identical query this session already verified
    live for the cards/historico/metas badges.
  - **Follow-up, same chart**: a `"simulada"` bar's X-axis label now shows the month *after* its
    real `mes` (`rotuloMes()` in `renderizarGraficoGastos()`, `(item.mes % 12) + 1` wrapping
    December→January) — explicit user call-out: a Brazilian fatura's `mes` is its consumption
    *reference* month (see `enviar_fatura.js`'s `referencia` parsing), but the bill itself only
    arrives the month after that reference month closes. So a value still labeled `"simulada"`
    today (no real fatura for it yet) is, in practice, a preview of *next* month's incoming bill,
    not a closed number for the current one — e.g. today being July, a simulated July data point is
    shown under "Ago" instead, and July's own slot shows nothing until July's real fatura actually
    arrives. **Deliberately display-only, inside this one chart function** — does *not* touch
    `agregados_reais_e_simulados()`, `evolucao_mensal()`, or the `itens` array itself, since that
    repository method is the shared source-of-truth `cards()`, `historico.js`, and the Meta
    projection all key off too; shifting the actual `(ano, mes)` there would ripple into all of
    those and risks a real collision (a shifted month landing on the key that month's *own* later
    real/simulated entry would occupy) for the sake of one chart's label. `"real"` items are never
    shifted — only a fatura's own true reference month is ever displayed for it. Confirmed via
    AskUserQuestion before implementing, since a wrong shift direction here would make the chart
    actively misleading rather than just incomplete. Verified with jsdom: a `mes=5` "simulada" item
    labels as "Jun", a same-month "real" item stays unshifted, and a `mes=12` "simulada" item
    correctly wraps to "Jan" (year boundary) while a `mes=12` "real" item stays "Dez".
- **Resolved**: `dashboard.html`'s "Evolução Mensal" chart (`renderizarGraficoEvolucao()`, a
  *different* chart/function from "Gastos Mensais" above — this one's the kWh line chart near the
  top of the dashboard) had a second dataset, "Média" (the dashed blue line), that was 100%
  fabricated: `i.consumo_kwh * (0.8 + Math.random() * 0.4)` — a fresh random multiplier on *every*
  render, so the line visibly reshuffled itself on every single page reload. User noticed this
  directly ("toda vez que atualizo a página, ele muda os dados") and correctly suspected it wasn't
  reading from real data — same bug class as the already-fixed fake `"-12%"` trend and fake
  `"15% menor que a média regional"` insight earlier in this file, just never caught in this
  specific chart. The green "Consumo" line was never affected — that one's always been the real
  `consumo_kwh` from `evolucao_mensal()`, same source as everything else on this page.
  - Replaced with a real trailing 3-month moving average of the series' own `consumo_kwh` values
    (`itens.slice(Math.max(0, indice - 2), indice + 1)`, averaged) — there's no regional/external
    benchmark data source anywhere in this codebase (same conclusion already reached once for the
    coverage insight), so a comparison against the user's *own* recent history is the honest option,
    not an invented external one. The first 1–2 points in the window (not enough prior months yet)
    average over however many exist rather than being left undefined. Fully deterministic — the
    line no longer changes between reloads with the same underlying data, which was the actual
    complaint.
  - Verified with jsdom against the real `dashboard.js`: calling `renderizarGraficoEvolucao()` twice
    with identical input now produces byte-identical output (the direct regression test for "changes
    on every refresh"), the moving-average values themselves checked by hand for a 4-point series
    (including the windowing at the start and the slide once 3 prior points exist), and confirmed
    the "Consumo" dataset and chart labels are untouched by this change.
- **New**: the 4 top KPI cards on `dashboard.html` (Consumo Mensal, Custo Est., Potencial de
  Economia, Meta Mensal) got a visual + explanatory pass, per explicit user scoping ("visual +
  explicações", not a silent full redesign) — user picked this over "só visual" and "você decide".
  - **`campoComInfoHtml()`/`alternarInfoCampo()` moved from `historico.js` to `js/ui.js`** — same
    reasoning as `alternarFaq`'s earlier move (see that bullet): a second page now needs the same
    "label + (i) button → inline explanation on click" pattern, so it belongs in the shared file, not
    duplicated. `historico.js`'s own call sites (`campoComInfoHtml(...)` used when rendering fatura
    detail fields) are untouched — only the *definition* moved, confirmed no leftover duplicate.
    Since `js/ui.js` is already confirmed loaded before every page-specific script (see the
    `alternarFaq`/cookie-modal bullets above), no page needed a new `<script>` tag for this.
  - Each of the 4 cards' `.card-title` is now wrapped in a `.campo-info-wrapper` with a small (i)
    button; clicking reveals one honest, backend-grounded sentence per metric (not generic copy):
    Consumo Mensal/Custo Est. explain the real-fatura-vs-calculated-estimate origin (same logic as
    the `vencimento` field already on the Custo Est. card); Potencial de Economia
    explains it's a sum of `Recomendacao.economia_valor_potencial` across *every* recommendation ever
    generated for the account (`dashboard_energia_repository.py::cards()`) — confirmed via reading
    `app/models/recomendacao.py` that there's no status/dismissed field, so summing all of them is
    correct, not a bug; Meta Mensal explains the bar is a *projection at current pace* vs. the
    user's `teto_kwh`, not consumption-so-far — worth spelling out since `preencherMetaMensal()`'s
    math (`projecao_mensal_kwh / teto_kwh`) genuinely isn't what a progress bar usually implies.
  - `.card-title` gained `display:flex; align-items:center; gap:4px` (additive — a no-op for any
    other page's plain-text `.card-title`, only dashboard.html's page-scoped `<style>` block is
    affected) so the (i) button sits inline with the label instead of wrapping.
  - `.card-fundo-verde` (the solid-green "Potencial de Economia" card) needed explicit `.btn-info`/
    `.texto-info-campo` color overrides — both default to colors meant for a light surface
    (`--on-surface-variant` icon, `--surface-container` box), which would be near-invisible on a
    solid `--primary` green fill without this.
  - `.card-borda-azul` ("Custo Est.") gained a `background: var(--surface-container-highest)` wash
    alongside its existing left-border accent — reuses the exact token (`#dae2fd`) already used this
    session for the "estimado" bar color in the Gastos Mensais chart, so the light-blue = cost/estimate
    association reads consistently in both places rather than being a one-off.
  - Meta Mensal gained a small `.icone-meta` (target icon, 3 concentric circles) — the one card among
    the 4 with no icon/badge/color accent of its own before this; the other three already had a
    badge, a border+tint, or a full color fill respectively, so this was a real asymmetry, not
    decoration for its own sake. Consumo Mensal/Custo Est. deliberately did *not* get an extra
    decorative icon on top of their existing badge/border — a compact 2-up mobile grid card already
    has a badge or accent plus now an (i) button; a third simultaneous marker risked crowding a card
    that's roughly half a ~360–390px-wide phone screen.
  - **Found while reading `historico.js` for this, unrelated to the cards**: it defines its own
    top-of-file `formatarMoeda(valor)` that returns just `"245,30"` (no `"R$"`, via
    `Number(valor).toLocaleString('pt-BR', {minimumFractionDigits:2,...})`) — a *different* function
    from `js/ui.js`'s `formatarMoeda` (`"R$ 245,30"`, via `toLocaleString(..., {style:"currency",...})`).
    Same global name, different behavior; `historico.js` loading after `ui.js` means historico.html's
    page context silently uses the local one everywhere on that page. Not touched — no bug was
    reported against it and this session didn't audit what `historico.js`'s specific rendering calls
    actually depend on that number-only shape — but worth knowing before ever moving more shared code
    near this name, since assuming `ui.js`'s `formatarMoeda` behavior on `historico.html` would be
    wrong.
  - Verified with jsdom against the real `dashboard.html`/`dashboard.js`/`ui.js`/`historico.js`: all
    4 `.campo-info-wrapper`s present with the right title text and non-trivial explanation text: the
    info-toggle click/re-click cycle correctly flips `.visivel` and `aria-expanded` using the
    *shared* `ui.js` function; every ID `preencherCards()`/`preencherMetaMensal()` depend on
    (`card-valor-estimado`, `card-vencimento`, `barra-meta-fill`, etc.) still
    exists and still gets populated correctly end-to-end; `historico.js` no longer defines either
    function (confirmed zero matches) but still calls `campoComInfoHtml` and correctly resolves it
    from `ui.js`; and the CSS block is brace-balanced. Also re-ran the existing mobile-gate jsdom
    suite as a regression check since it shares `js/ui.js` with this change — still 11/11 passing.
    Confirmed all touched files (`dashboard.html`, `js/ui.js`, `js/paginas/historico.js`) serve
    correctly over real HTTP via Apache. As with the earlier index.html visual pass, none of this was
    confirmed in an actual rendered browser — no screenshot/browser-automation tool is available in
    this environment — so a real look is still owed before calling the visual result final.
  - **Follow-up, same pass**: the `badge-origem-mes` "Fatura real"/"Estimado" badge (top-right of the
    Consumo Mensal card) was removed at the user's explicit request — the real/estimado distinction
    for that card now lives *only* in its (i) button's explanation text (added in the bullet above),
    not as a separate always-visible badge. Removed the `<span id="badge-origem-mes">` element,
    unwrapped the now-single-child `.flex.justify-between.items-start` div it used to share with the
    title (no longer needed with nothing to justify-between), and deleted `preencherCards()`'s badge
    population branch in `dashboard.js` — the shared `.badge-status-analisada`/`.badge-status-processamento`
    classes themselves were *not* touched, since `historico.js`'s own per-item badges still use them.
    Re-verified with jsdom: `preencherCards()` no longer throws with the badge absent from the DOM
    (confirmed via try/catch around the call, not just that a stale check silently passed), and
    confirmed zero remaining references to `badge-origem-mes` in both the served HTML and JS.
- **Resolved**: `insights.html`/`js/paginas/insights.js` (the 5th bottom-nav tab, "Insights" —
  `partials/bottom-nav.html`, real and reachable, not orphaned) was badly broken — not just "shows
  placeholder data" but had several genuine response-shape bugs that made it show fabricated numbers
  *unconditionally*, regardless of what real data existed:
  - `apiGet("/recomendacoes/")` returns a **plain array** (confirmed both by reading
    `recomendacao_router.py::listar()` and live against a real account), but the old code read
    `res.recomendacoes` — always `undefined` → always fell through to 2 hardcoded fake recommendations
    ("Evite alto consumo entre 18h e 21h...", "Sua geladeira antiga gasta 3x mais..."), *even when
    real recommendations existed*. The same bug independently broke "Economia Estimada": `total`
    always stayed `0` → always fell back to a hardcoded `R$ 42,30`, which then fed a fabricated
    `total * 0.3` "kg of CO2 offset" claim with no real emissions-factor source anywhere in this
    codebase (same category of problem as the already-fixed fake trend/meta/regional-average values
    on the dashboard, just never caught here). The CO2 line was removed outright rather than
    replaced with a differently-fake number — there's no established, sourced kWh→CO2 factor in this
    project to compute a real one, and `recomendacoes.js` (the actual Recomendações page) never made
    this claim either.
  - `apiGet("/assinaturas/minha-assinatura")` returns the plan object directly with a nested
    `.plano.tipo` field (confirmed live: `{id, plano: {tipo: "FREE", ...}, status, ...}`), but the
    old code read `res.assinatura.nome` — always `undefined` → `isFree` was **always `true`**,
    meaning the "Limite do Plano Grátis" banner and "Seja Premium" upsell card would show even to a
    paying Premium account. Fixed to mirror the already-established, working pattern from
    `aparelhos.js::obterLimiteAparelhos()`: `assinatura.plano?.tipo === "FREE"`.
  - Recommendation cards used a nonexistent `rec.tipo_sugerido`/`rec.icone_tipo` and guessed the
    category by string-matching `descricao` for the word "upgrade" — replaced with the real `rec.tipo`
    field (`economia_personalizada` | `troca_equipamento` | `ranking_consumo`, confirmed against
    `app/models/recomendacao.py` and live-generated recommendations) mapped through
    `ROTULOS_RECOMENDACAO`, the exact lookup table `recomendacoes.js` already used correctly — **moved
    to `js/ui.js`** (same reasoning as `alternarFaq`/`campoComInfoHtml`'s earlier moves: a second page
    now needs it) rather than duplicated, and `recomendacoes.js`'s own copy deleted.
  - `/metas/minha-meta`'s shape (`orcamento_reais`, `projecao_mensal_reais`, `teto_kwh`,
    `projecao_mensal_kwh`) was actually already correct in the old code — its router docstring in
    `meta_router.py` says outright this endpoint was purpose-built for this exact Insights card. Only
    polish here: the "no meta yet" state used to show fake `"R$ 0,00"`/`"0 kWh"`/`"0%"` numbers
    instead of an honest "Sem meta" — fixed to match `dashboard.js::preencherMetaMensal()`'s existing
    "Sem meta cadastrada" convention.
  - The "Mensal"/"Anual" tab toggle above the history chart had **no click handler at all** — pure
    decoration, "Anual" did nothing. Wired up (`alternarModoHistorico()`), aggregating the *same*
    already-fetched `historico` array client-side by `ano` (no new endpoint — `/dashboard/energia/historico`
    has no month-count/granularity parameter to begin with). Required calling `.destroy()` on the
    previous Chart.js instance before creating a new one on tab switch — same "Canvas is already in
    use" hazard already anticipated (but never actually triggered, since nothing before this
    re-rendered onto a live canvas) in this file's dashboard-chart bullets earlier in this doc. The
    active-tab visual state was *also* dead — the "active" look was hardcoded as inline styles on the
    "Mensal" button specifically, not driven by the `.ativa` class the toggle logic sets, so a
    `classList` toggle alone wouldn't have changed anything visually; added a page-scoped
    `.abas .aba.ativa` CSS rule (overriding the shared, differently-styled `.aba.ativa` from
    `componentes.css`, which is a plain underlined-tab style — this page uses a pill/segmented-control
    look) and removed the inline styles so the class toggle actually drives the look.
  - **Found while fixing this, unrelated**: every `.innerText` assignment in this file (13 of them)
    was switched to `.textContent` — functionally equivalent here (none of these needed
    `.innerText`'s CSS-aware "rendered text" semantics, they're all plain string-into-element cases)
    and consistent with `.textContent` already being the convention `dashboard.js`/`historico.js` use.
    Motivated by a real jsdom gotcha hit while verifying this fix: jsdom's `.innerText` setter doesn't
    sync with `.textContent` at all (confirmed in isolation — setting one leaves the other
    completely unchanged), so anything written with `.innerText` was silently unverifiable with this
    project's established jsdom-based testing approach, not just for this session but for good.
  - **Verification, in order**: (1) read every consumed endpoint's actual router/schema code
    (`recomendacao_router.py`, `assinatura_router.py`, `meta_router.py`,
    `dashboard_energia_repository.py::historico_mensal_agregado`) to know the real shapes before
    writing any fix, rather than guessing from the broken code's assumptions; (2) hit every one of
    those endpoints live against a fresh throwaway account (empty-state and then populated with a
    real residência/aparelho/recomendação/duas metas) to confirm the shapes match what was just read
    — caught nothing new here, but this is the exact step that caught the `meta_router.py` bug
    earlier in this project, so it wasn't skipped; (3) a full jsdom pass using those *exact* captured
    real payloads as fixtures (not invented ones) driving the real `insights.html`/`insights.js`/
    `ui.js`, covering: FREE vs. PREMIUM plan detection, populated vs. empty recommendations, the
    "always-fake-42,30" regression specifically, chronological history ordering, the new Anual
    aggregation and its `.destroy()` call, active-tab class toggling, and both meta states — 34/34
    passing. One test-harness-only gotcha hit and worked around, not a bug in the shipped code: jsdom
    doesn't share top-level `const`/`let` bindings (`NOMES_MES`, `ROTULOS_RECOMENDACAO`) across
    *separate* `window.eval()` calls the way real `<script>` tags in one document actually do — fixed
    by re-stubbing those two constants directly in the test harness, confirmed in isolation first
    before assuming it was the cause. Also confirmed all touched files serve correctly over real
    HTTP via Apache.
- Super Admin panel (`../DESIGN-DESKTOP.MD`) not started — explicitly deferred to a separate pass.
- Stripe checkout, real SMTP, and Google OAuth are all still unconfigured in `../api.energycalc.com.br/backend/.env` — the
  frontend already degrades gracefully for all three (clear toasts/503 messages), nothing to fix
  here, just don't expect `Assinar Premium`, e-mail links, or the Google button to fully work
  end-to-end in this environment yet.
- No automated frontend tests exist. Verification has meant real Playwright runs against both dev
  servers each time — screenshots for anything visual, full request/response/console capture for
  anything behavioral.
