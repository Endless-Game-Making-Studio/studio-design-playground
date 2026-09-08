# Reference: porting the frontend infrastructure

The new frontend is a rebuild in the stack the current app already uses (Nuxt 4,
Vue 3, Nuxt UI 4, Tailwind 4). The pieces below already solve backend-facing
problems correctly, and most of their complexity is a scar from a real bug. Port
them; do not redesign them from the backend docs.

Every path is relative to `frontend/`.

| Piece | Source | Verdict |
| --- | --- | --- |
| `useGraphQLQuery` | `app/composables/useGraphQLQuery.ts` | Port as is |
| `useStreamingGraphQLQuery` | `app/composables/useStreamingGraphQLQuery.ts` | Port when streaming is needed |
| GraphQL client plugin | `app/plugins/graphql-request-plugin.js` | Port, add TypeScript |
| `useBackendError` | `app/composables/useBackendError.ts` | **Do not port** — replace |
| `useParentalConsentPolling` | `app/composables/useParentalConsentPolling.ts` | Port as is |
| `RestrictedButton` | `app/components/Generic/RestrictedButton.vue` | Port as is |
| OIDC client | `app/plugins/auth/AuthService.js` | Port the flow, **fix the storage** |
| Language sync | `app/plugins/user-language.js` | Port as is |
| Theme config | `app/app.config.ts` | Port as is |
| Nuxt config | `nuxt.config.js` | Port the marked subset |
| `MarkdownBody` | `app/components/Generic/MarkdownBody.vue` | Port as is |
| Permission constants | `app/types/permissions.ts` | Port as is |
| S3 upload flow | `app/plugins/custom/fileUpload.js`, `app/utils/file.ts` | Port, drop axios |
| Route middleware | `app/middleware/` | Port selectively |
| Locale files | `i18n/locales/en.json`, `es.json` | Port wholesale |
| `graphql_schemas/` | `app/graphql_schemas/` | **Do not port** |
| Vuex store, mixins | `app/store/`, `app/mixins/`, `app/plugins/mixin.js` | **Do not port** |

## 1. useGraphQLQuery — port as is

The single most valuable file to carry over. It wraps `useAsyncData` and encodes
four behaviours you would otherwise rediscover by shipping bugs.

```ts
const { data: project } = await useGraphQLQuery<Project>(
  gql`
    query GET_PROJECT($input: GetProjectByIdInput) {
      getProjectById(input: $input) {
        id
        name
        short_description
      }
    }
  `,
  { variables: () => ({ input: { id: projectId.value } }) },
)
```

Contract to preserve:

- **QueryAuth** (`Required` default, `Anonymous`, `Optional`). The backend
  exposes public twins of authenticated queries (`getProjects` vs
  `getPublicProjects`), so a component often needs "run only when logged out".
  When the gate rejects, the fetcher returns a skipped marker and the transform
  substitutes the default value — it does not throw.
- **flattenData** (default `true`). Unwraps the response only when it has
  **exactly one** top-level key, so `data` holds the root field's value. A
  two-root-field document comes back unflattened; that asymmetry is deliberate.
- **validateData** (default: data must be truthy). On failure it builds
  `createError({ statusCode: 404 })` and **throws inside the transform**, which
  makes `useAsyncData` record the failure on `error` and keep `data` at the
  default. That is what lets a template guard with `v-if="!error"`.
- **showError deferral.** Calling `showError` while the owning component is still
  mounting disrupts the mount, and the component's render error surfaces instead
  of the error page. The composable checks `getCurrentInstance()` and defers to
  `onMounted`; outside a component (route middleware) it shows immediately. Drop
  this and errors get misreported on first paint.
- **The watch list is `[$auth.token, skip, ...userWatch]`.** Every query
  refetches when the token changes. This is what makes login and logout repaint
  the app.
- **Key** is generated as `$gql` plus an `ohash` of query and variables, matching
  the format `useFetch` uses. Pass `key` explicitly only to share a cache entry.
- `query`, `variables`, and `skip` each accept a ref or a getter and are wrapped
  in `computed`, so passing a getter makes the query reactive.
- Two overloads: with `default` the data type excludes `undefined`; without it,
  includes it.

The usage rule that comes with it: `await` the call in `setup` so the page or a
`<Suspense>` boundary owns the spinner, instead of every component rendering its
own skeleton.

## 2. useStreamingGraphQLQuery — port when needed

Same family, for responses consumed incrementally. Not needed on day one; port it
when the first streaming surface appears rather than rebuilding it then.

## 3. GraphQL client plugin — port, add TypeScript

`app/plugins/graphql-request-plugin.js` provides `$graphqlRequest` with `query()`,
`mutate()`, and `subscribe()`. It is JavaScript today; the port is the moment to
type it.

Contract to preserve:

- **Two clients.** `graphql-request` over HTTP, `graphql-ws` for subscriptions.
  Both are **rebuilt when the token changes**, and the old WS client is
  terminated first. A cached client holding a stale `Authorization` header is the
  failure this prevents.
- **Auth.** HTTP sends `Authorization: Bearer <token>`. WS sends the same string
  as `connectionParams.Authorization` — capital A — and the connection is
  rejected outright without a valid user. There is no anonymous subscription.
- **Apollo Studio headers** on every HTTP request:
  `apollographql-client-name` set to the literal `frontend`, and
  `apollographql-client-version` set to the app build id. Renaming the client
  fragments segmentation history in Apollo Studio. Both are in the backend's CORS
  allowlist; arbitrary custom headers are not, and fail at preflight.
- **The GraphQLError wrapper class.** `ClientError` from graphql-request
  stringifies the entire response into `message`, which is unreadable. The
  wrapper narrows `message` to the first error's message and **preserves
  `response`, `request`, and `statusCode`**. Preserving `response` is what makes
  `err.response.errors[0].extensions.code` reachable — keep it.
- `query()` and `mutate()` are the same call; the split exists only to make the
  intent readable at the call site. Keep the split.

## 4. useBackendError — do not port

`app/composables/useBackendError.ts` toasts the backend's raw message. Backend
messages are internal English written for developers and are not renderable to
users.

Build the replacement in its place: read `err.response?.errors?.[0]?.extensions`,
switch on `code` (`BAD_USER_INPUT`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `LIMIT_EXCEEDED`, `INTERNAL_SERVER_ERROR`), refine with `detail`
(`USER_EMAIL_DUPLICATE`, `INVALID_LOGIN`, and so on), and render a locale key.
`issues` carries a zod array on the event and file modules. Full code and detail
tables: `reference-api.md` section 4.

No component in the current app reads `extensions`, so there is no prior art to
copy — this is new code either way. Writing it once, centrally, is the point.

## 5. useParentalConsentPolling — port as is

Polls the parental-consent status every 5s (VueUse `useIntervalFn`) while a k-ID
challenge is open.

The non-obvious part is the completion test: `myParentalConsentChallenge` becomes
`null` when the challenge resolves, and only then does `me.has_parental_consent`
distinguish approval from denial. Reading `has_parental_consent` alone reports
denial for every still-pending challenge.

Also preserve: the `resolved` latch so callbacks fire once, `pause()` on
resolution, re-arming when `enabled` or `challengeId` changes, and
`onScopeDispose(pause)`.

Note that the `myParentalConsentStatus` subscription exists in the schema but
nothing calls it. Polling is the shipped path; do not switch to the subscription
without testing it.

## 6. RestrictedButton — port as is

`app/components/Generic/RestrictedButton.vue` is the permission gate. It wraps
`UButton` in a `UTooltip`, passes attrs through (`inheritAttrs: false` plus
`useAttrs()`), and swaps in a gating variant when restricted.

| Prop | Effect |
| --- | --- |
| `restrictedPartner` | Opens `RestrictedPartnerAccount/RestrictedPartnerInfoModal` via `useOverlay()`, passing the viewer's first institution name |
| `vpc` | Opens `KID/KIDChallengeModal` with the action key; when the result outcome is `granted`, emits `vpcGranted` |
| `vpcAction` | The action key handed to the k-ID challenge |

When restricted it forces `variant: 'gating'`, `color: 'kids'`, and a trailing
icon (`i-lucide-shield` for VPC, `i-lucide-lock` otherwise), and intercepts the
click with `preventDefault()`. Both modals are `defineAsyncComponent` imports —
keep them lazy.

Map the backend permission value onto the props:

| Permission value | Handling |
| --- | --- |
| `allowed` | Render normally |
| `restricted_partner` | `:restricted-partner="true"` |
| `parental_consent_required` | `:vpc="true"` plus `vpc-action`, refetch on `@vpc-granted` |
| `application_required` / `code_required` | Route to the application or enrollment-code flow |
| `not_authenticated` | Route to login |
| `not_allowed` / `unavailable` / `not_member` | Explain; do not render the control |

Extend this component for a new reason rather than forking it.

## 7. OIDC client — port the flow, fix the storage

`app/plugins/auth/AuthService.js` (418 lines) is a complete, working
Authorization Code + PKCE client built on `openid-client` and `jose`. The flow is
correct and hard-won — port it.

Public surface worth keeping: `token` and `userData` (both readonly refs),
`loggedIn`, `user`, `requireLogin()`, `hasRole(...ids)`, `isAdult` / `isMinor`,
`isAdmin` / `isLeader` / `isEditor` / `isProgramAdmin` / `isInstitutionAdmin`,
`startLogin()`, `startSignup({ signupCode })`, `handleLoginCallback(route)`,
`refreshTokens()`, `fetchUser()` / `fetchUserOnce()`, `startLogout()`,
`handleLogoutCallback()`, `setRedirectReturn()` / `returnToApp()`.

Two details already correct and easy to lose:

- `isAdult` reads `user?.age_category === 'adult'` — the k-ID server-side
  decision — and the file carries a comment saying not to compute age from a
  birthday on the client. Keep both.
- Token expiry is derived by decoding `exp` with `jose`, not by trusting a stored
  timestamp.

**What not to port: the token storage.** Today the access token, refresh token,
and id token all sit in `useStorage` (localStorage), while the logout state
correctly uses `sessionStorage`. The access token is an RS256 bearer JWT valid
for **7 days**, with no rotation and no revocation other than the `logout`
mutation, on a platform with minors: an XSS is a week of account access. In an
existing app that is debt; in a rebuild it is a choice. Keep the access token in
memory and put the refresh token in the most restricted mechanism available.

This is a team decision with a real cost — an in-memory token means a full page
reload re-runs the refresh — so raise it before building rather than porting the
localStorage version by default. The redirect path and PKCE code verifier have
different exposure and can stay in web storage.

### Provider mechanics that shape the client

Four backend-side facts. Each produces a failure whose symptom does not point at
its cause.

**The provider is mounted under `/oidc`, not the account server root.**
`/oidc/auth`, `/oidc/token`, `/oidc/jwks`, `/oidc/me`, `/oidc/request`,
`/oidc/session/end`. Only discovery lives at the root
(`GET {ACCOUNT_URL}/.well-known/openid-configuration`, internally rewritten).
Configure by discovery and never hardcode paths — without the prefix every call
hits the account server's 404 handler. Source: `backend/src/account/app.ts`.

**`resource` must be byte-identical to the backend's `API_URL`.** The lookup is an
exact `Map.get` and `defaultResource` returns `undefined`, so a trailing slash — or
`127.0.0.1` where the backend default says `localhost` — produces `invalid_target`.
And **`resource` and UserInfo are mutually exclusive**: with it, the access token
works only against the API server and **cannot** be used at `/oidc/me`; without it,
only UserInfo works. The app needs the API token, so disable automatic UserInfo
loading (`loadUserInfo: false` and equivalents) — calling it returns an invalid
token on every login. With `resource` present, `profile` and `email` claims arrive
in the ID token and the rest of the profile comes from the GraphQL `me` query.
Source: `backend/src/account/README.md`, `backend/src/account/oidc/provider.ts`.

**Redirect URIs are an exact-match allowlist**: `{HOST_URL}/auth/callback/` and
`{HOST_URL}/auth/logout-callback/`, both with the trailing slash — so the new app
must keep those two route paths. Under `NODE_ENV=development` the allowlist also
contains `http://localhost:3000`, `http://127.0.0.1:3000`, and
`http://127.0.0.1:3333` (reserved for e2e), with the same two paths. **The same
allowlist drives the account server's CORS** — `clientBasedCORS` accepts an origin
only if it is the origin of a registered `redirect_uri` — so an unregistered origin
fails the browser code exchange as a **CORS error**, not `invalid_redirect_uri`.
Register the new app's dev, preview, and branch-deploy origins backend-side before
expecting login to work.

**TTLs** in `providerConfig.ttl`: access token 7 days, id token 7 days, interaction
1 hour, grant 14 days, session 14 days. **`RefreshToken` is not configured** — its
TTL and rotation come from `oidc-provider ^9.6.0` defaults. Assume the worst case:
each refresh may return a new refresh token that must replace the stored one, the
14-day grant and session are a ceiling, and a failed refresh is a re-login rather
than a bug. Confirm with the backend team before designing renewal.

## 8. Language sync — port as is

`app/plugins/user-language.js` watches the authenticated user and, on
`metadata.preferred_lang_id`, calls **both** `$i18n.setLocale()` and
`$dayjs.locale()`. Setting only the first leaves every date in English. Declared
`dependsOn: ['auth']` with `{ immediate: true }`.

## 9. Theme config — port as is

`app/app.config.ts` (111 lines) carries the design system as Nuxt UI theme
overrides. Color aliases: `primary` orange, `secondary` cornflower, `kids` teal,
`info` sky, `warning` amber, `success` lime, `error` red, plus `neutral` from
`nuxt.config.js`.

It also defines the custom button variants `gating` (used by `RestrictedButton`)
and `contrast`. Port the file wholesale — it originates in the design team's
system, and rebuilding it by eye reintroduces drift the team already removed.

New styles belong here as variants, not as per-component overrides.

## 10. Nuxt config — port the marked subset

From `nuxt.config.js`, carry over:

- `ssr: false` and static generation. The app must stay statically generatable:
  no SSR, no server routes, no Node runtime in production.
- `ui.colorMode: false` and the eight-color `ui.theme.colors` list.
- Modules: `@nuxtjs/i18n`, `@nuxt/eslint`, `dayjs-nuxt`, `@nuxt/ui`,
  `@vueuse/nuxt`.
- `components: { dirs: [] }` — component auto-import is **off** on purpose;
  imports are explicit.
- `runtimeConfig.public`: `apiBaseUrl`, `accountUrl`, `accountClientId`,
  `graphqlRequest.httpEndpoint` and `.wsEndpoint`, `amplitudeApiKey`,
  `useMockData`. Env defaults: `API_BASEURL` and `GRAPHQL_BASEURL` on
  `localhost:3003`, `GRAPHQL_WSBASEURL` on `ws://localhost:3003/graphql`,
  `ACCOUNT_URL` on `localhost:3005`, `ACCOUNT_CLIENT_ID` `frontend`.
- i18n: `en` and `es`, `lazy: true`, `strategy: 'no_prefix'`, `defaultLocale: 'en'`.
- dayjs plugins: `localizedFormat`, `relativeTime`, `timezone`, `advancedFormat`.
- The `typescript.tsConfig` / `nodeTsConfig` split for Nuxt-env vs Node-env tests.

Leave behind: the `axios.baseURL` entry (nothing reads it), the CDN Font Awesome
stylesheet, and the `optimizeTranslationDirective: false` workaround unless the
devtools bug it works around still reproduces.

Keep `nuxt.config.js` and `.env.example` in sync — the file says so at the top.

## 11. MarkdownBody — port as is

`DOMPurify.sanitize(marked.parse(content, { async: false, gfm: true }))`, rendered
through `v-html` on a `prose` container. This is the only sanctioned path for
user-authored and GitHub-authored markdown, and the lint rule against raw HTML
injection has a narrow allowlist that includes it. Any other `v-html` needs the
same sanitization.

## 12. Permission constants — port as is

`app/types/permissions.ts` (92 lines) declares each permission field's reason enum
as a `const` object plus a matching type, in the
`export const X = {...} as const` / `export type X = (typeof X)[keyof typeof X]`
pattern. Twelve of them, one per permission field:
`UserProfileImages`, `UserChangeUsername`, `UserPublishProfile`, `ProjectJoin`,
`ProjectPost`, `ProjectSubmitTask`, `ProjectDiscord`, `TaskSubmit`,
`ProgramJoin`, `ProgramPost`, `ProgramSubmitTask`, `ProgramCreateProject`.

Each declares only the values that field can actually return — `ProjectJoin` has
`allowed` / `application_required` / `not_allowed` / `restricted_partner`, while
`ProjectDiscord` has `allowed` / `not_authenticated` /
`parental_consent_required`. That per-field narrowing is the value: it makes a
comparison against a value the field never returns a type error.

Port the file as is and keep it in sync with the schema. Note it does not cover
`ProjectPermissions.publish`, which is a real `Boolean!` rather than a reason
enum.

## 13. S3 upload flow — port, drop axios

`app/plugins/custom/fileUpload.js` implements the three-step upload. The shape is
fixed by the backend:

1. `createFileUploadLink(input: { name, mime_type, size })` returns
   `secure_upload_url`, `additional_s3_security_fields`, `file_id`,
   `file_instance_id`.
2. `additional_s3_security_fields` is a **JSON string** — parse it, append every
   key to a `FormData`, then append the file **last** under the key `file`. S3
   presigned POST policies require the file field last.
3. **POST** the FormData to `secure_upload_url` (not PUT), and treat **HTTP 204**
   as the only success. Then call
   `markFileInstanceUploaded(input: { file_instance_id })` and return the file
   instance id.

The donor uses `axios` solely for `onUploadProgress` and a cancel token. `fetch`
plus an `AbortController` covers cancellation; if you need a progress bar, use
`XMLHttpRequest` for this one call rather than carrying a second HTTP client for
the whole app.

`app/utils/file.ts` (136 lines) holds the client-side size and mime validation
that runs before step 1 — port it so the user gets a local error instead of an S3
rejection.

## 14. Route middleware — port selectively

`app/middleware/` has eight files. Three are worth carrying:

- `auth.js` — the route-level login requirement.
- `complete-signup.global.js` — the account server blocks authorization behind
  verify / birthday / terms prompts, but parental consent is **not** an OIDC
  prompt, so signup completion still needs a client-side gate.
- `ensure-trailing-slash.global.js` — the OIDC redirect allowlist is exact-match
  and both entries carry a trailing slash, so URL normalization is load-bearing
  for login, not cosmetic.

Evaluate the rest (`authorize-leader`, `authorized-user-link-processor`,
`normalize-url`, `scroll-to-top`, `studio-base-redirect`) against the new app's
routing rather than porting them by default.

## 15. Locale files — port wholesale

`i18n/locales/en.json` and `es.json` are translated content, not code. Copy both
and delete keys as screens are rebuilt, rather than retranslating. The donor's
`en.json` is flat; nest **new** keys.

## 16. What not to port

- `app/graphql_schemas/` — 21 modules with 129 importers. Pre-made shared query
  documents rot: a component ends up fetching fields it does not use, and breaks
  when another consumer edits the document. The GraphQL document belongs in the
  component that reads it. Do not create this directory.
- The **Vuex store** (`app/store/`). State belongs to the feature; fetch where you
  use it, and reach for `provide` / `inject` before a global store.
- **Mixins** (`app/mixins/`, `app/plugins/mixin.js`). Composables replace them.
- The **bespoke modal system**. Use `UModal` with `useOverlay()`; awaiting
  `open()` lets the parent refresh when the modal closes.
- **`<style>` blocks duplicating Tailwind**, and any raw palette color
  (`text-gray-500`, `bg-red-100`). Semantic tokens only.
- Legacy widget wrappers — `vue-multiselect`, `vue-datetime`, `vue-timeago`,
  `floating-vue` — where Nuxt UI and VueUse now cover the need.
- `useBackendError` (section 4) and the localStorage token storage (section 7).
