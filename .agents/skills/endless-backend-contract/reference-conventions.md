# Reference: conventions, tests, commits, antipatterns

Sources: `frontend/docs/CONTRIBUTING.md` (148 lines, canonical for frontend
practice), `frontend/docs/Components.md` (301 lines, the register of reusable
components), `frontend/.claude/skills/code-review/SKILL.md` (151) and `reference.md`
(405, canonical for severity, format, and the mechanical antipattern tables),
`frontend/tests/README.md` (test layout and mechanics), `frontend/CLAUDE.md` (agent
process rules), `docs/GIT_RULES.md` (canonical for git), `backend/CONTRIBUTING.md`
(backend practice, useful for mirroring vocabulary).

Precedence when they disagree: `frontend/docs/CONTRIBUTING.md` wins on the rule; the
`code-review` skill wins on severity and output format; and per that skill, **do not
introduce a rule that does not exist in CONTRIBUTING.md** unless it is a general,
uncontroversial best practice. That limit applies to this skill too.

## 1. Monorepo layout and tooling [CONTRACT]

- Two subprojects with **separate** toolchains: `frontend/` and `backend/` each
  have their own eslint, prettier, tsconfig, test runner, `yarn.lock`, and yarn
  scripts. The only shared configuration is the root `.editorconfig`, the root
  husky/lint-staged wiring, and `docs/GIT_RULES.md`.
- Do not create yarn workspaces or hoisting between the two. Installation is
  per-subproject via the root `postinstall`
  (`husky && yarn install:packages` -> `cd frontend && yarn install`,
  `cd backend && yarn install`). Workspaces would change the `node_modules` layout
  that CI and the Dockerfiles assume. Source: root `package.json`.
- Node 22 and Yarn 1 via `corepack enable yarn`, pinned by `packageManager` in
  every `package.json`. Do not migrate to pnpm/npm/Yarn Berry and do not remove
  `packageManager`. Source: `README.md`, `.github/workflows/*.yml`.
- `.editorconfig` applies repo-wide: 2-space indent, `end_of_line = lf`, UTF-8,
  trim trailing whitespace, final newline. Markdown is exempt from trailing
  whitespace trimming. CRLF on a Windows machine produces whole-file diffs.
- `post-checkout` and `post-merge` hooks both run `yarn install`, so dependencies
  are reinstalled on branch switch - do not assume a stable `node_modules`.

### CI gates [CONTRACT]

`.github/workflows/frontend-checks.yml` runs, with `working-directory: ./frontend`:

```
yarn run lint
yarn run typecheck
yarn run generate     # nuxt generate --fail-on-error today
yarn run test         # unit + integration
```

`.github/workflows/e2e-checks.yml` runs `yarn test:e2e` on push to `dev`,
installing only Chromium (`yarn playwright install --with-deps chromium`) and
seeding the backend env from `backend/.env.development.example`. Changing the e2e
runner or requiring another browser means updating that workflow.

Keep the script **names** even if the implementation changes. The backend uses
`type-check` with a hyphen and the frontend `typecheck` without - do not unify
them, CI calls both literally.

### Production build constraints [CONTRACT]

- Deploy is AWS Amplify in static mode: the build runs the static preset and
  publishes `frontend/.output/public`. The Amplify app is configured for the WEB
  platform, not WEB_COMPUTE, so anything needing a Node runtime in production does
  not exist there. No SSR, no server routes, no server middleware. Source:
  `amplify.yml`.
- The generate step runs with `--fail-on-error`: any route that throws during
  prerender fails the build even if it works in dev. Data-dependent routes need
  handled fallbacks. Source: `frontend/package.json`,
  `.github/workflows/frontend-checks.yml`.
- Cache rules in `customHttp.yml` key off asset paths: immutable one-week caching
  for `/_nuxt/**` and 6 hours for `/images/**`. A new asset layout (`/static/`,
  `/assets/`) is served with no configured caching until that file is updated.
- What production **does not** have, each inherited by omission rather than choice:
  - `customHttp.yml` contains only those two cache rules. There is no
    Content-Security-Policy, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, or
    `Referrer-Policy`. So no CSP currently constrains what the app loads - the
    `nuxt.config.js` head pulls Font Awesome from `cdnjs.cloudflare.com` and Amplitude
    talks to an external domain - but that is absence of policy, not permission. If a
    CSP is ever added it goes in that file, those two external origins break first, and
    the inventory of external origins becomes something to maintain.
  - No rewrite or redirect rules. With `ssr: false` plus the static preset, every route
    that must answer a direct URL depends on prerender or Nuxt's SPA fallback; there is
    no Amplify-side "200 rewrite to /index.html" covering the gap.
  - `frontend/robots.txt` says `User-agent: *` / `Disallow: /`, but it sits at the
    **root** of `frontend/`, not in `frontend/public/` (which holds `images/`,
    `example_csv.csv`, `example_cohort_csv.csv`). Only `public/` is published, so the
    intent to exclude crawlers is currently not in effect; moving it to
    `public/robots.txt` is what would enforce it. Either way, do not invest in
    SEO/sitemap work while that policy stands, and do not treat missing indexing as a
    bug. Trailing-slash routing beyond the two OIDC callback paths is open in the same
    way. Source: `customHttp.yml`, `amplify.yml`, `frontend/nuxt.config.js`.

### Hooks and pre-commit reality [CONTRACT]

- Root `.husky/pre-commit` runs `yarn lint-staged`. The frontend's lint-staged
  config (in `frontend/package.json`) runs `eslint --fix` plus `prettier --write`
  over the literal glob `**/*.{js,ts,vue,css}`. New extensions (`.tsx`, `.scss`,
  `.mts`) are silently skipped until the glob is updated.
- The frontend pre-commit does **not** run typecheck or tests (the backend's
  lint-staged does run `yarn tsc --noEmit`). Run `yarn typecheck` and `yarn test`
  manually before pushing; closing that gap in the new setup is a reasonable
  improvement.
- Never use `--no-verify` or otherwise skip hooks. Since lint-staged is the only
  place eslint/prettier run before push, skipping it just moves the failure to CI.
- Root-level files (`docs/*.md`, `.github/**`, `amplify.yml`) are covered by no
  lint-staged config at all. Code placed outside `frontend/` gets no commit-time
  lint.
- Prettier errors are ESLint errors in both subprojects
  (`eslint-plugin-prettier/recommended` is last in the config). Do not configure
  formatting in parallel in the editor: `frontend/.vscode/settings.json` sets
  `prettier.printWidth: 150`, which conflicts with the project `.prettierrc` -
  trust `.prettierrc`.

## 2. Where the frontend conventions actually live [PRACTICE]

Do not read a paraphrase. Both canonical files are in this repo and are shorter than
any restatement of them:

- `frontend/docs/CONTRIBUTING.md` (148 lines) - component design, state, data
  fetching, immutability, routing, "Use the Platform", TypeScript, naming, events,
  i18n, comments, migration strategy, review checklist.
- `frontend/.claude/skills/code-review/reference.md` (405 lines) - the mechanical
  antipattern-to-fix tables, including the full raw-color-to-token mapping. It ships as
  a skill (`frontend/.claude/skills/code-review/`), so it can be invoked directly.

Read the first before writing a component and the second before self-reviewing. What
follows is only what neither of them covers, or what they cover in a place an agent
will not look.

### Components and structure

- Component name pattern is `[Context][Presentation]` (for example
  `UserPortfolioCard`); a component file lives at
  `app/components/<Feature>/<Context><Presentation>.vue` with its types in
  `app/components/<Feature>/types.ts`. Import components explicitly - auto-import was
  disabled deliberately. Multi-word component names are required (the lint rule is
  currently disabled behind a FIXME saying it should be enforced; comply rather than
  keeping it off).
- Emit custom events in camelCase, listen in kebab-case.
- Register reusable components in `frontend/docs/Components.md`. That file states the
  obligation directly ("Please add new components to this document as they are added to
  the project"), so creating one without registering it is a review omission, the same
  class of miss as deleting a feature and leaving its locale keys.
- The canonical wrappers named there, to reuse rather than recreate:
  - `Generic/RestrictedButton.vue` - the single gate for restricted-partner and
    parental-consent checks (props `restricted-partner`, `vpc`, `vpc-action`; emits
    `vpcGranted`). Opens `KID/KIDChallengeModal.vue` or
    `RestrictedPartnerAccount/RestrictedPartnerInfoModal.vue` as appropriate.
  - `Generic/UConfirmationModal.vue` - the canonical `useOverlay` pattern
    (`overlay.create(defineAsyncComponent(...))` then `await open()`), which every
    other modal follows.
  - `Generic/InfiniteScroll.vue` - scroll pagination. Its `item` slot hands over
    `{ item, index }`, so inside the slot the datum is `item.item`.
  - `Generic/MarkdownBody.vue` - the sanctioned path for already-sanitized user and
    GitHub markdown.
  - `App/AppPage.vue`, `App/AppDetailPage.vue`, `App/AppSimplePage.vue` - page
    layouts; spacing and banners are solved once, not per page.

### Styling tokens

- Semantic tokens only. Text: `text-dimmed`, `text-muted`, `text-toned`,
  `text-default`, `text-highlighted`, `text-inverted`. Background: `bg-default`,
  `bg-muted`, `bg-elevated`, `bg-accented`, `bg-inverted`. Border and ring:
  `border-default`, `border-muted`, `border-accented`.
- Typical rewrites: `text-gray-400` -> `text-dimmed`; `text-gray-500` -> `text-muted`;
  `text-gray-600` -> `text-toned`; `text-gray-700` -> `text-default`;
  `text-gray-800`/`900` -> `text-highlighted`; `text-white` on dark ->
  `text-inverted`; `bg-white`/`bg-{color}-50` -> `bg-default`; `bg-{color}-100`/`200`
  -> `bg-elevated`.
- Forbidden: any raw `{prefix}-{color}-{shade}`, a hex inside a class
  (`text-[#374151]`), an inline color style, a `<style>` block duplicating a utility,
  and - easy to miss - `ring-*`, `shadow-*`, `outline-*` using raw palette shades.
  `neutral-*`, `zinc-*`, `slate-*`, `stone-*` all count as raw for UI chrome; data viz
  is the exception.
- Color aliases live in `frontend/app/app.config.ts` under `ui.colors`: `primary`
  (orange), `secondary` (cornflower), `kids` (teal), `info`, `warning`, `success`,
  `error`, plus `neutral` in the `nuxt.config.js` theme list. Note `kids`, which is
  product-specific. Reusable styling becomes a variant there
  (`ui.<component>.variants` / `compoundVariants`), never a per-component override.
- The complete mapping table is in `frontend/.claude/skills/code-review/reference.md`.
  Consult it instead of guessing a token name.

### i18n

- Keys live in `frontend/i18n/locales/en.json` (always) and `es.json` (when a
  translation exists); config is `frontend/i18n/i18n.config.ts`. Read them with
  `const { t } = useI18n()` in `<script setup>` and `$t('key')` in templates -
  `useI18n` is auto-imported.
- Never hardcode a human-readable string, not even a trivial one. Error pages and
  fallback states are not exempt (the legacy error page shipped hardcoded English).
  Never show a raw backend message; map code plus `extensions.detail` to a key.
- `en.json` is **flat** today (`"create_profile": "Create Profile"`). Nest **new** keys
  (`malware.scan_label`), but do not migrate existing flat keys as a side effect of
  feature work - a key rename is its own commit.
- `frontend/tests/unit/i18n/translations.test.ts` is the gate, and it checks three
  kinds of drift per locale: keys in `en` missing from the locale, orphan keys not in
  `en`, and **placeholder parity** - it extracts `{name}` tokens from each string and
  compares the sets, so a translation that drops, renames, or adds a placeholder is
  drift even when the key exists. Copy placeholders literally.
- **Failure mode: warning fail, not hard fail.** The test sets `task.meta.warningFail`
  and prints the lists with `console.warn`; its only assertion is
  `expect(Object.keys(locale.keys).length).toBeGreaterThan(0)`. i18n drift therefore
  does **not** block CI - it shows as `✗ [warn] <label>` in the custom reporter and as
  `N warning fail` in the summary. Treat it as debt to clear inside the PR, because
  nothing will stop the merge for you.
- `en` is the reference locale by constant (`REFERENCE_LOCALE = 'en'`) and the test
  enumerates `i18n/locales/*.json`, so adding a third locale automatically creates a
  new drift report.

### Comments and writing

- A comment must be additive and carry the non-obvious WHY, never the WHAT, and be
  understandable in a ten-second scan. Prefer clear names and descriptive test names.
  Justify choices that look over- or under-engineered so the next reader does not
  re-litigate the trade-off. Redundant comments are a "Nit" finding.
- **Readability beats density and breadth.** Multiple sentences are fine when each
  sentence is easy; what is forbidden is compressing concepts into dense noun chains
  and dragging in tangentially related internals. The canonical "bad" example in
  `frontend/CLAUDE.md` is not too long - it is one run-on paragraph stacking three
  mechanisms; the "good" one has a title, a blank line, an embedded code example, and
  one idea per sentence. The same standard covers commit messages, PR descriptions,
  review replies, code comments, and docs.

## 3. Tests [CONTRACT on layout]

- Files live in `frontend/tests/{unit,integration,e2e}/**/*.test.ts` - suffix
  `.test.ts`, **not** `.spec.ts`. The vitest projects are named `unit`, `integration`,
  `e2e` and the scripts select them by `--project <name>`; renaming a project or
  changing an `include` pattern makes CI run zero tests silently.
- Helpers, mocks, and fixtures live in `tests/helpers`, `tests/mocks/handlers`,
  `tests/mocks/fixtures`, one handler and one fixture file per domain (the same
  operation is fired by many components). The mock server runs with
  `onUnhandledRequest: 'error'` so an unmocked request fails loudly.
- **The tier boundary is the environment, not taste.** `unit` runs in
  `environment: 'node'` (pure logic offline: file IO, regex, data comparison);
  `integration` runs in `environment: 'nuxt'` with MSW (anything needing the real
  runtime: plugins, auto-imports, `useNuxtApp`, GraphQL, router). This is reinforced by
  tsconfig: `nuxt.config.js` puts `tests/integration/**`, `tests/helpers/**`, and
  `tests/mocks/**` in the **app** tsconfig and `tests/unit/**` plus `tests/e2e/**` in
  the **node** tsconfig, so a test in the wrong directory fails typecheck for a
  non-obvious reason.
- `tests/integration/` has **three fixed buckets**: `pages/` (one folder per page),
  `workflows/` (one folder per independent workflow), `composables/` (one file per
  shared composable whose contract callers rely on). It is not free-form.
- Two mount helpers, same runtime, different targets: `tests/helpers/mount-page.ts`
  (`mountPage`, uses `mountSuspended`, boots real plugins and mixins, unmounts the
  previous wrapper between scenarios so reactive state does not leak) and
  `tests/helpers/mount-composable.ts` (`mountComposable`, calls the composable inside a
  harness `setup()`, with the same auth seeding so gating works under the real `$auth`).
- `disableConsoleIntercept: true` and the custom reporter (`tests/reporter.ts`) in
  `vitest.config.ts` are deliberate: the reporter exists to render warning fails.
  `warnPresent` (from `tests/helpers/warn-assert.ts`) is the sanctioned way to flag "an
  expected component is missing" while keeping CI green; `expect(...).toBe(true)` is the
  hard fail. Choosing between them is an explicit decision when writing a presence test.
- E2E shares **one** backend stack in docker, so files run serialized
  (`fileParallelism: false`) with wide timeouts (hook 300s, test 60s). Do not write e2e
  assuming parallel isolation or a per-file database. It needs five free ports and
  fails fast otherwise: **3333** (Nuxt test server - not a free choice, it is the value
  in the account server's OIDC redirect allowlist), **3103** (API), **3105** (account
  server), **5533** (Postgres), **6479** (Redis). Overrides that exist and should keep
  existing: `E2E_USER1` / `E2E_USER1_PASSWORD` (fixture user, default in
  `tests/e2e/setup/credentials.ts`), `E2E_READY_TIMEOUT_MS` (default 600000),
  `E2E_SCREENSHOTS=1` (full-page PNGs under
  `tests/screenshots/<suite>/<test>/<viewport>/<label>.png`, gitignored, overwritten
  each run). It requires Docker plus `yarn playwright install chromium` and **does not
  run in PR CI** - only on push to `dev` - so an e2e regression lands on `dev` before
  anyone sees it. Do not rely on it as a PR gate.

Two safety nets stand in for codegen:

1. `frontend/tests/unit/operations-conform-to-schema.test.ts` walks app source,
   extracts every GraphQL document, and validates it against
   `backend/gql-schema.graphql`. It is a hard fail (`expect(errors).toEqual([])`) and
   the only mechanism catching field/argument/nullability drift. Its mechanics decide
   what it can see, so they are load-bearing:
   - Only literals tagged `gql` are extracted (the regex is
     ``/gql`([\s\S]*?)`/g``). A document in a `.graphql` file, in a plain string, or
     produced by a codegen helper is **invisible**.
   - Only `.js` / `.ts` / `.vue` files **under `frontend/app/`** are walked. Nothing in
     `tests/`, `server/`, or the repo root is validated.
   - Interpolations are stripped before parsing (`${...}` removed), and fragment
     composition works only because **all fragments in `app/` are pooled globally** and
     each operation is validated against the whole pool.
   - Because of that pool, `UniqueOperationNamesRule`, `UniqueFragmentNamesRule`, and
     `NoUnusedFragmentsRule` are switched off. Two fragments with the same name in
     different files do not fail the test and validation may match the wrong one, so
     fragment names are unique by convention, not by check.
   - `frontend/app/graphql_schemas/endstar/` is excluded by path segment.

   If the way documents are written ever changes, this test has to be rewritten in the
   same commit or schema drift silently stops being detected.
2. Schema-first mocks: the mocked response is executed against the same SDL, so a
   renamed field, a non-existent operation, a non-null violation, or a wrong enum fails
   the test that uses the mock.

Neither catches **type** drift - a stale hand-written interface passes both. See
SKILL.md "Open questions" item 6.

Backend test naming, for reference when reading backend code: tests live in `tests/`
inside the module with a `.spec.ts` suffix; resolver tests are `*.resolvers.spec.ts`
(plural is the real convention despite what `backend/CONTRIBUTING.md` says).

## 4. Git and review process [CONTRACT]

From `docs/GIT_RULES.md`:

- Branch from a freshly fetched `origin/dev`:
  `git fetch origin && git checkout -b <branch> origin/dev`. Kebab-case name describing
  the work, **no** issue-number prefix (the number belongs in the PR description and on
  the board). Do not branch from a stale local `dev` or from another feature branch
  unless stacking is deliberate.
- PRs always target `dev`. Never push directly to `dev`, `staging`, or `prod`;
  promotion is dev -> staging -> prod through the manual `promote.yml` workflow, which
  is the only legitimate way those branches are written.
- Commit subject: imperative, under 70 characters, optionally prefixed with an area
  (`program: Fix a thing`). Conventional Commit tags (`feat:`, `fix:`, `chore:`) are
  forbidden, as are "Added"/"Fixing"/"Updated some stuff".
  (`backend/CONTRIBUTING.md` states 52 characters with a mandatory module prefix - see
  SKILL.md "Open questions" item 2.)
- Commit body shape: Title / What / Why / Context, with absolute ISO dates
  (`2026-04-28`) never relative ones, full GitHub URLs when referencing an issue or PR
  (never `#N`, which silently mis-links across repos), and no trailer pointing at the
  commit's own PR. Three rules about that body that change the text you write:
  - **Match length to the change.** Most bodies are 1-2 sentences; reach for 4 only
    when the why is non-obvious (lists, code blocks, and tables do not count). A body
    **can be empty** when the title already tells the story. The four-part shape is a
    mould, not a quota.
  - **Generalize what changed.** The diff already shows which files moved; the body
    says what the change accomplished. Prefer concepts (the rule, the API surface, the
    visible behaviour, the feature area) to paths: "Move CONTRIBUTING into docs/" tells
    the story, while listing the files duplicates `git diff --stat`. A specific
    identifier earns its place when it is the noun the rule is about (`$dayjs`,
    `useRouteQuery`); a path or test-file name almost never does.
  - **Write for the returning reader, not for today's author.** Answer "what was the
    motivation?", "what failure does this fix?", "can we remove this workaround yet?",
    "why this approach and not the obvious one?" Open with what the reader recognises -
    motivation, symptom, visible behaviour, decision - not with what you discovered
    while investigating.
- Atomic commits: one logical fact each, no "and" in the subject, a working codebase at
  every point in history. Refactors and cleanups get their own commits. Assets,
  fixtures, and config land in the same commit as their first use. Sizing question,
  asked before every commit: "what is the Minimum Viable Commit here, the smallest
  useful change I can make?" The industry default is too big; aim smaller than feels
  natural.
- **Revise history before sharing** - a step of its own, distinct from responding to
  review. Before opening the PR, use `git rebase -i` to remove, reorder, edit, merge,
  and split commits: squash "fix typo" into the commit that introduced the typo, merge
  WIP, reorder refactors ahead of the behaviour change that motivated them. Per-commit
  self-check: "if I were writing this codebase from scratch today, knowing everything I
  know now, would I write this commit?" If the answer is no for any of them, rebase
  until it is yes for all.
- Address review feedback (or a change of mind) by amending/rebasing the original
  commit plus `git push --force-with-lease`. Never "address feedback", "fix per
  review", or "actually let's do it this way" commits. After the amend the history
  should read as if the fix was always there.
- Never `--no-verify`, never skip pre-commit hooks. Before any git action (commit,
  branch, rebase, amend, force-push, push), re-read `docs/GIT_RULES.md` -
  `frontend/CLAUDE.md` makes it required reading on onboarding and after any update to
  that file.
- No AI trailers in anything committed - specifically no `Co-Authored-By: Claude`.
  Avoid AI filler ("Let's dive into", "It's worth noting", "In summary", "Certainly!")
  in commits, PR descriptions, review replies, code comments, and docs.
- Run the `code-review` skill before the first push and again before marking the PR
  Ready, resolving Blocking and Important findings before pushing. Three of its rules
  change what counts as a finding:
  - **Scope is strict**: only files the branch touched (`git diff dev...HEAD
    --name-only`) plus the uncommitted working tree (untracked, unstaged, staged).
    Files that exist on `dev` and were not touched are out of scope, so flagging a
    pre-existing pattern in an untouched file is not a finding. Within a touched file, an
    inherited (not introduced) pattern is a Nit, not an Important.
  - **Read the whole file, not just the hunk.** Diff hunks show about three lines of
    context, which is not enough for flow risks (a guarded value escaping its guard, a
    call site outside the expected scope, the same pattern repeated three files over
    with drift). The procedure requires reading the current content of each touched file
    end to end.
  - **Commit-history violations are review findings**, not style: "and" in the subject,
    non-atomic scope, a message that does not match the diff, a missing or post-hoc
    WHY. The review walks `git log dev..HEAD --reverse -p` commit by commit before
    looking at code.
  (The backend's copy of that skill still says `master` and references a root-level
  `CONTRIBUTING.md` that does not exist - do not copy either detail.)
- There is no PR template, issue template, or CODEOWNERS in `.github/` (only workflows
  and one composite action). PR description structure is convention, not a form.
- Report review findings with a severity: Blocking / Important / Nit / Good, print
  every section even when empty (`None.`), and include the per-category coverage trail -
  a missing section means the review was incomplete. The Blocking set is `any` shipped,
  contract violations the consumer sees, accessibility regressions, and **props leaked
  through templates** (`props.user` in `<template>`).

### Agent process rules

From `frontend/CLAUDE.md`:

- Explicit per-session authorization is required before mutating GitHub state
  (creating/closing/editing/commenting on an issue, PR, review thread, or board item)
  or switching branches in a shared working tree. Read-only `gh` is free. Board
  mutation additionally needs `gh auth refresh -s project`.
- Board flow is Backlog -> In Progress -> In Review; stop at In Review (whoever merges
  moves it onward).
- Self-update protocol: when a review produces a generalizable rule, fix the PR **and**
  propose the permanent rule, in two steps. Code practice goes to the subproject's
  `docs/CONTRIBUTING.md`; a mechanical antipattern-to-fix mapping goes to
  `.claude/skills/code-review/reference.md`; an agent process rule goes to `CLAUDE.md`.
  Scan the whole target file first, show the proposed text, and land it as its own
  atomic commit on the originating branch **with the chain in the body**: originating
  thread, the commit that surfaced the rule, and why this prevents a repeat.
- Drive-by observations ("this field should be non-nullable", "this should throw") are
  follow-up bugs on the Meta issue, not new rules in CONTRIBUTING.

## 5. Full antipattern table

Mechanical rows. The canonical source is
`frontend/.claude/skills/code-review/reference.md`; these are the ones an agent working
from this skill most often needs, plus the API rows that do not appear there.

### i18n

| Antipattern | Correction |
| --- | --- |
| Hardcoded user-facing string | Locale key in `i18n/locales/en.json` |
| Duplicate key in the same locale | One key, reused |
| Key used but not defined | Define it in `en` (and `es` when translated) |
| Key defined but never used | Delete it |
| Flat prefixed **new** key (`malware_scan_label`) | Nested object (`malware.scan_label`) |
| Translation missing or renaming a `{placeholder}` | Copy placeholders literally |
| Key rename mixed into feature work | Separate commit |

### Colors and styling

| Antipattern | Correction |
| --- | --- |
| Raw palette color for text / background / border | The matching semantic token |
| `ring-*`, `shadow-*`, `outline-*` with a raw shade | The semantic equivalent |
| Hex inside a class (`text-[#374151]`) | Semantic token |
| Inline color style, or a `<style>` block duplicating a utility | Semantic token / the existing utility |
| Per-component override of a shared pattern | Variant in `app/app.config.ts` |
| Fixed height on a content container | Padding, so it scales with viewport and font size |

### TypeScript

| Antipattern | Correction |
| --- | --- |
| `any` | `unknown`, a real type, or a commented cast |
| Bare non-null assertion | Add a comment justifying why it is safe |
| `as unknown as X` | Fix the type at its source |
| Generic names (`data`, `result`, `config`, `item`, `obj`) | Descriptive names; rename on destructuring |
| Ad-hoc duplicate interface | Reuse the shared type |
| `import type { Foo }` never referenced | Remove it |

### Components and state

| Antipattern | Correction |
| --- | --- |
| Parent holding a map of children's open/closed flags | State belongs to the child, or `useOverlay` |
| Boolean configuration flags for special cases | Slots / composition |
| Manual watch + router replace for URL state | The library's query-param helper |
| `if (loggedIn) fetchA() else fetchB()` | One reactive call whose query is chosen by a getter |
| Tabs and sub-views as conditionals in one page | Nested routes |
| Imperative router navigation for a link | Link element/component |
| Child mutating parent data | Child emits; parent refetches |
| Server data or modal state in a global store | Fetch in the feature; `useOverlay` for modals |
| Post-mutation local array patching | Refetch or replace the object |
| Swallowing an error by returning it as a result | Propagate or handle explicitly |
| A new reusable component absent from `frontend/docs/Components.md` | Register it |

### Templates

| Antipattern | Correction |
| --- | --- |
| `props.user` read in a template (**Blocking**) | Destructure in the script: `const { user } = defineProps<{...}>()` |
| Array index as list key | Stable unique item key |
| Conditional and iteration on the same element | Filter in a computed value, or split levels |
| Logic (especially mutation) inline in a handler | Named function |
| Clickable div | Button element |
| Missing `alt` / no label on an icon-only button | Add them |
| Unsanitized HTML injection | Sanitize; the lint allowlist is narrow |
| `:disabled="true"` on a boolean prop | `disabled` shorthand |

### Helpers

| Antipattern | Correction |
| --- | --- |
| `new Date(x).toLocaleDateString()` | `useDayjs()` / `$dayjs` with the app locale |
| Hand-rolled primitive | Existing helper from VueUse or another adopted library |
| Custom form error plumbing | `UForm` with zod schema validation |

### General quality

| Antipattern | Correction |
| --- | --- |
| Leftover `console.log` / `console.error` | Remove |
| TODO/FIXME with no issue reference | Add the reference or remove |
| Magic number/string | Named constant |
| Function doing several things | Split |
| Three-plus nesting levels | Early returns |
| Anything declared and unused | Delete |
| Removing a feature but leaving its GraphQL documents and locale strings | Delete those too |

### API usage (contract-level, outranks style)

| Antipattern | Correction |
| --- | --- |
| `user.image_url` | `user.metadata.image_url` (but `UserProfile.image_url` is top level) |
| A local date formatter into a `DateTimeStr` | `new Date().toISOString()` - the value must end in `Z` |
| Building a Relay `edges { node }` reader | Read `data` + `pageInfo` + `totalCount` |
| Rendering `file.file_url` immediately | Gate on `malware_status === 'NO_THREATS_FOUND'` |
| Skipping `markFileInstanceUploaded` | Always call it after the S3 POST |
| `Accept-Language` header for locale | Update `metadata.preferred_lang_id` |
| Re-implementing a backend rule client-side | Read the backend's `permissions` / `*_count` fields |
| Selecting `intake_form_signup_code` for a normal user | Omit it - a 403 there poisons the response |

The rest of the API rows are in SKILL.md.

## 6. Legacy patterns not to recreate

The donor app documented these as its own debt. None of them travel into the new
app:

- A global state store holding server data or "which modal is open".
- A bespoke store-driven modal system (modal id plus payload in global state).
- A global mixin injecting methods, dictionaries, and hardcoded English status strings
  into every component.
- Centralized query modules: `frontend/app/graphql_schemas/` still has 21 modules with
  129 importers. Do not add to it.
- Post-mutation local patching (splicing an item out of an in-memory array instead of
  refetching).
- Swallowing network errors by returning the error object as if it were a result, and
  `useBackendError()`, which toasts the raw backend message.
- Hardcoded text on the error page and other fallback states.
- A second HTTP client kept only for the S3 upload (the leftover
  `runtimeConfig.public.axios.baseURL` is its residue).
- A parallel CSS theme with its own color names and type scale competing with the
  design-system tokens.
- Turning off the multi-word component name lint rule (the config disables it behind a
  FIXME that explains the risk).
