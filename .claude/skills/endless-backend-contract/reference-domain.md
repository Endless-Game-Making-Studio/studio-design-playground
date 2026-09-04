# Reference: domain map and canonical vocabulary

The backend is organized **by feature (module)**, not by file type - 36 modules in
`backend/src/modules/`. Mirror that decomposition and reuse the same module names
in the frontend so a screen can be traced to its schema and interactor in one hop.
Source: `backend/CONTRIBUTING.md` "Directory Structure".

## 1. Module names to mirror

Directory names are lowercase, kebab-case for compound names. Use these exact
names for frontend feature folders:

```
abac  abstract  achievement  activitylog  analytics  cohort  event  faq
feed  file  github  group  healthcheck  institution  interest  job
material  newsfeed  notification  object  object-mention  page
parental-consent  person  program  project  project-application
project-category  quiz  report  roadmap  role  signupcode  task  user
user-program-certificate
```

Verified by `ls backend/src/modules` (36 entries). Two traps: the learning-material
module is named **`material`**, not `object-material` (the GraphQL types are
`ObjectMaterial*`), and `faq`, `healthcheck`, `material`, `report`, and `roadmap` are
real modules that are easy to miss.

Backend file naming, for locating the contract (`<Entity>` in PascalCase):

```
User.schema.ts       SDL fragment for the module
User.resolvers.ts    thin GraphQL adapter (plural - the real convention)
User.interactor.ts   all business logic and Knex queries (the only file in all 36 modules)
User.model.ts        the Postgres row type
User.policy.ts       declarative ABAC authorization
User.validators.ts   only 3 modules have one
tests/*.spec.ts      tests, inside the module
```

There is **no** service or DAO layer. The interactor is logic plus data access in
one. Do not create a "service" layer in the frontend expecting to mirror
something - the frontend analogue of an interactor is the data-fetching layer.

Counts to calibrate expectations: 36 interactors, 31 schemas, 30 resolvers,
26 policies, 48 models, 83 spec files, zero `*.resolver.ts` singular.
One file has a typo in its name and is imported that way:
`backend/src/modules/page/Page.schems.ts`.

### Feature domains the rest of this skill does not cover

- **faq** - `getFaqs(input: GetFaqsInput)`, `getFaqById(input: FaqIdInput)`,
  `createFaq`, `updateFaq`, `deleteFaq`, all `@auth`. `Faq` is scoped by project and
  `sort_order` is a **String**, not a number. `GetFaqsInput` uses `projectId` in
  **camelCase** while the type field is `project_id`. Source:
  `backend/src/modules/faq/Faq.schema.ts`.
- **roadmap** - `getRoadmaps(input: GetRoadmapInput)`, `getRoadmapById`,
  `createRoadmap`, `updateRoadmap`, `deleteRoadmap`, all `@auth`. `project_id: Int!`
  is required on create **and** update. Copy the asymmetry as-is:
  `Roadmap.imageFile` is `Int` on the type but `String` (a base64 data URL) on the
  inputs, so `createRoadmap`/`updateRoadmap` belong to the inline-image list in
  `reference-api.md` section 13. Source:
  `backend/src/modules/roadmap/Roadmap.schema.ts`.
- **report** - `userReport2(input: DateRangeInput)` and `intakeFormReport` return
  `{ base64_encoded_report: String }`. Not a pageable list: it is a whole report in
  base64 that the client decodes and offers as a download.
  `DateRangeInput { start: DateTimeStr!, end: DateTimeStr! }` - both required, both
  must end in `Z`. Source: `backend/src/modules/report/Report.schema.ts`.

### Modules that are NOT user-facing features

Do not create frontend features for these:

- `abstract` - base class for interactors.
- `abac` - the authorization engine.
- `object`, `object-mention` - supertype table and mention plumbing.
- `activitylog` - only exposes `ActivityLog` via `Project.activity_log`.
- `role` - schema and model only, no resolvers registered.
- `job` - BullMQ administration surface, not an end-user feature.
- `healthcheck` - exposes only `check` (see `reference-api.md` section 11 and 19).

## 2. Architectural boundary [CONTRACT]

- Resolvers are thin; interactors are fat. Do not re-implement backend business
  logic in the frontend - eligibility rules, counts, and permissions are computed
  server-side and exposed as fields (`permissions`, `*_count`) precisely so the
  client does not duplicate them. Source: `backend/CONTRIBUTING.md` section 1.
- Lookup vs operate: `getXById` returning `null` is legitimate ("not found" is a
  read state, not an error), while a mutation against a missing resource throws
  `NOT_FOUND`. Model the read case as an empty state.
- Authorization has **two independent layers**:
  1. Policy (ABAC in `@auth`) - "may this operation be invoked?" -> `FORBIDDEN`.
  2. Row-level filtering inside the interactor - "which rows come back?" -> a
     shorter list, no error.
  A short or empty list is scope, not a bug. Source: `backend/CONTRIBUTING.md`
  section 7.
- ABAC vocabulary: SUBJECT is `user` (`user.id`, `user.role_ids`,
  `user.user_task_ids`, ...), ACTION is the exact GraphQL field name (aliases are
  safe), RESOURCE is a type derived from the action. The default is deny: if no
  policy matches the action, only `role_id` 1 (ADMIN) passes. Source:
  `backend/src/modules/abac/policyDecisionPoint.ts`.
- Consequence: operations with no policy of their own are effectively admin-only
  (`getUsers`, `addUserRole`, `removeUserRole`, `toggleUserVerified`,
  `getUsersWhoTookQuizById`, `intake_form_signup_code`, ...). Source:
  `backend/src/modules/user/User.policy.ts`.
- ABAC is blind to time, IP, and environment (`getEnvironment()` returns `{}`), so
  do not build UI assuming permissions that vary by hour or geography.
- Parental-consent denials do **not** come from ABAC - the consent policy allows
  any authenticated user, and the real restrictions are thrown by the interactor
  with specific messages, plus surfaced in the `*Permissions` fields. Source:
  `backend/src/modules/parental-consent/ParentalConsent.policy.ts`.

## 3. Roles [CONTRACT]

There is no role enum in GraphQL - roles are numeric ids in
`User.role_ids: [SafeInt!]!` and `Role { id, name }`. The frontend must replicate
the table.

System roles (`backend/src/modules/user/User.model.ts`,
`backend/src/modules/role/Role.model.ts`):

```
1   ADMIN
2   Member
3   Leader
5   Mentor
14  PROGRAM_ADMIN
16  Student        (remapped to 18 by migration; do not reference)
18  PROGRAM_MEMBER
19  CONTENT_EDITOR
20  INSTITUTION_ADMIN
```

Removed by migration - referencing them is dead code: 4 (Project follower), 6, 7,
9, 10, 11, 13, 15, 16, 17. Source:
`backend/migrations/20260707120000_cleanup-unused-roles.js`,
`backend/migrations/20260707115632_drop-follower-role.js`.

Cohort roles live in a **separate id space** (`cohort_role` table) and never
appear in `me.roles` or `me.role_ids`:

```
21  Cohort Member
22  Cohort Admin
```

The `role` table has a CHECK constraint reserving 21 and 22 for cohort roles, so
role-keyed tables reject them by construction. To know whether someone is a Cohort
Admin, use the cohort queries (which already filter by access). Source:
`backend/src/modules/cohort/Cohort.model.ts`,
`backend/migrations/20260716120000_create-cohort-tables.js`, `backend/db-schema.txt`.

**Check system roles with `me.role_ids`, never `me.roles`.** `role_ids` comes only
from `user_role`; `roles` is a UNION of `user_role` with `user_group`, so it
includes project/program/institution/team-scoped roles and produces false
positives (a project Leader looks like a global "Leader"). Existing frontend code made
exactly this mistake. Source: `backend/src/modules/user/User.interactor.ts`.

UI implications actually implemented in the backend:

- ADMIN (1) passes every `@auth` via the admin policy set, sees private profiles,
  sees `digital_youth` users without consent, and sees private fields on any user.
- INSTITUTION_ADMIN (20) sees full profiles for users in their institution.
- PROGRAM_ADMIN (14) and Cohort Admin (22) get broader access to cohorts, tasks,
  and feeds within their scope.
- Leader (3) / Mentor (5) / Member (2) are project-scoped.

Assume nothing beyond that from a role's name. Source:
`backend/src/modules/user/User.interactor.ts` (`canViewFullProfile`),
`backend/src/modules/user/User.resolvers.ts`.

## 4. Permission fields [CONTRACT]

Read these instead of trying an action and handling the error.

```graphql
User.permissions: UserPermissions! {
  profile_images, change_username, publish_profile
}
Project.permissions: ProjectPermissions! {
  join: ProjectJoinPermission!
  post: ProjectPostPermission!
  submit_task: ProjectSubmitTaskPermission!
  discord: ProjectDiscordPermission!
  publish: Boolean!            # the only boolean
}
Program.permissions: ProgramPermissions! {
  join, post, submit_task, create_project
}
Task.permissions: TaskPermissions! {
  submit: TaskSubmitPermission!   # allowed | not_member | parental_consent_required
}
```

`ProjectPermissions.publish: Boolean!` is the **only** boolean in the whole set
("Whether the viewer may publish or archive the game"), so it is read with
`if (project.permissions.publish)`. `UserPermissions`, `ProgramPermissions`, and
`TaskPermissions` are 100% reason enums, so applying the enum rule to `publish`
(`=== 'allowed'`) is always false and hides the publish/archive control forever.

Every other value is a lowercase reason string, and each field has its own set -
verify per field in `backend/gql-schema.graphql`. The union of values seen:

```
allowed  not_allowed  not_member  application_required  code_required
restricted_partner  unavailable  not_authenticated  parental_consent_required
```

Render the reason, not a generic failure:

- `application_required` -> open the application flow.
- `code_required` -> ask for the enrollment code.
- `not_authenticated` -> prompt login.
- `parental_consent_required` -> open the consent flow.
- `restricted_partner` / `unavailable` / `not_allowed` -> explain, do not offer the
  action.

Do not build a new gate - the wrapper already exists:
`frontend/app/components/Generic/RestrictedButton.vue`. It takes
`restrictedPartner`, `vpc`, and `vpcAction`, renders the reason tooltip from locale
keys, opens `RestrictedPartnerAccount/RestrictedPartnerInfoModal.vue` or
`KID/KIDChallengeModal.vue` through `useOverlay()`, and emits `vpcGranted` so the
parent refetches. Map the backend permission value onto its props
(`restricted_partner` -> `:restricted-partner="true"`; `parental_consent_required` ->
`:vpc="true"` plus `vpc-action="<action key>"` and a refresh on `@vpc-granted`) instead
of writing per-screen checks. If a new reason value needs a new branch, extend that
component; do not fork it. It is documented in `frontend/docs/Components.md`. Source:
`backend/src/modules/user/User.interactor.ts` (`getUserPermissions`),
`backend/gql-schema.graphql`.

## 5. Minors and parental consent (k-ID / VPC) [CONTRACT]

- `me.age_category: AgeCategory` is `digital_youth` | `adult` | `null`, sourced
  from k-ID and re-evaluated at each login. **Never** compute age from
  `metadata.birthday` client-side. `null` means unclassified (no birthday/location,
  or k-ID unavailable) and must be treated with the same caution as
  `digital_youth`. The backend itself treats `null` as digital youth for privacy
  (it never includes `last_name` in `full_name` unless `age_category === 'adult'`).
  Source: `backend/src/modules/user/User.model.ts`,
  `backend/src/modules/user/User.interactor.ts`.
- Consent required means: `age_category === 'digital_youth'` and
  `parental_consent_granted_at == null` and k-ID enabled. Source:
  `backend/src/modules/parental-consent/consent.ts`.
- What the UI must block for a minor without consent, each signalled separately as
  `parental_consent_required`:
  - `me.permissions.profile_images` - no avatar or cover upload/change.
  - `me.permissions.change_username`.
  - `me.permissions.publish_profile` - cannot make the profile public.
  - `Project.permissions.discord` - `discord_url` comes back `null` when not
    allowed; do not try to derive it another way. Source:
    `backend/src/modules/parental-consent/discord.ts`.
  - `Task.permissions.submit` on tasks with `ip_license_required` - starting or
    submitting throws `ForbiddenError('Parental consent is required to start/submit
    this task')`. Disable before calling. Source:
    `backend/src/modules/parental-consent/ip-license-task.ts`.

### The consent flow

```graphql
query   myParentalConsentChallenge: ParentalConsentChallenge      # pending one, or null
mutation requestParentalConsent: ParentalConsentChallenge!
mutation sendParentalConsentEmail(email: String!): Boolean!
subscription myParentalConsentStatus: ParentalConsentStatusUpdate!  # PASS | FAIL | IN_PROGRESS

type ParentalConsentChallenge {
  challengeId: String!
  oneTimePassword: String!   # show as the code
  type: String!
  url: String!               # feeds the QR code
  otpExpiresAt: DateTimeStr! # roughly 1 hour
}
```

- The result is **asynchronous** (a k-ID webhook). The backend exposes
  `myParentalConsentStatus` over the WebSocket, but **this app does not use it** and
  nothing in `frontend/app/` calls `$graphqlRequest.subscribe`. The implemented path
  is polling: `frontend/app/composables/useParentalConsentPolling.ts` queries
  `myParentalConsentChallenge` plus `me.has_parental_consent` every 5000 ms -
  `myParentalConsentChallenge` becomes `null` when the challenge resolves, and
  `has_parental_consent` then distinguishes approval from denial. Reuse that
  composable (`enabled`, `challengeId`, `onGranted`, `onDenied`) instead of opening the
  app's first subscription; moving this flow to the WebSocket is a deliberate change,
  not the default.
- Already granted is `User.has_parental_consent: Boolean!`.
- Errors to handle explicitly (all thrown by the interactor):
  `BAD_USER_INPUT` "Parental consent has already been granted";
  `FORBIDDEN` "Parental consent is only required for digital youth";
  `BAD_USER_INPUT` "Cannot request parental consent without a birthday and
  location"; `BAD_USER_INPUT` "No active parental consent challenge; request one
  first" (calling `sendParentalConsentEmail` before `requestParentalConsent`).
  Source: `backend/src/modules/parental-consent/ParentalConsent.interactor.ts`.

## 6. Private fields on User [CONTRACT]

When the viewer is neither the user nor an admin, these come back `null` (or
`false`) rather than as an error - treat the null as "no permission", not "no
data":

```
email, location, metadata.birthday, metadata.discord_username
github_access_token          (owner only)
is_restricted_partner_account -> false
has_parental_consent          -> false
full_name                     -> last_name only concatenated when age_category === 'adult'
```

`last_name` is **not** in that list. `User.last_name`, `UserProfile.first_name`, and
`UserProfile.last_name` fall through to the default resolver: raw, no age filter, no
viewer nulling. Since `getProfileForUser` carries no `@auth`, an anonymous visitor can
read a `digital_youth` surname from a public profile. The compliance decision lives
only inside `full_name` (`getUserFullName` appends `last_name` only when
`age_category === 'adult'`), so **always render `User.full_name`** and never compose
`first_name` + `last_name`. `UserProfile` has no `full_name` field at all - on the
profile page render `first_name` only.

Source: `backend/src/modules/user/User.resolvers.ts:146, 154, 198, 201, 208`
(`getUserPrivateField`, `getMetadataPrivateField`), the `UserProfile` resolver map
(which defines neither name field), and
`backend/src/modules/user/User.interactor.ts:1452` (`getUserFullName`).

`intake_form_signup_code` is the **only non-root field with `@auth`** and has no
policy, so it is admin-only; a `FORBIDDEN` on it poisons the entire response
(HTTP 403 plus an entry in `errors`) even when the rest of the query is valid.
Never request it for a normal user. Source: `backend/gql-schema.graphql`,
`backend/src/modules/user/User.policy.ts`.

## 7. Project and program visibility [CONTRACT]

Projects with `status_id: hidden` and restricted-access projects do not appear in
listings **or** direct lookups for non-members and non-program-admins - so
`getProjectById` can return `null` for an id that exists. The visibility filter is
applied on the shared base query and combines project and program `read_access`,
project group membership, program ADMIN role, and cohort membership. Sibling
cohorts in the same program do not see each other's projects. Source:
`backend/src/modules/project/Project.interactor.ts`.

`Project.cohort` returns `null` both when there is no cohort and when the viewer
cannot see it - indistinguishable from the client. Source:
`backend/src/modules/project/Project.schema.ts`.

Deletes are generally permanent: `object.deleted_at` and a `softDelete()` helper
exist, but only institution, project-category, and quiz filter on it; project and
task do a physical delete, and **no** GraphQL type exposes `deleted_at`. Remove the
item from local state immediately and treat deletion as final. Source:
`backend/src/modules/object/Object.interactor.ts`,
`backend/src/modules/project/Project.interactor.ts`,
`backend/src/modules/task/Task.interactor.ts`.

## 8. Notifications [CONTRACT]

- List: `getUserNotifications(input: { user_id: Int!, offset, limit, object_types,
  notification_type_ids })` - offset/limit, not cursor.
- Badge: the subscription payload
  `SubscribedNotification { notification, unread_notifications_count }` already
  carries the count, so no extra query is needed after an event. Reset with
  `resetUnreadNotificationsCount`; mark one seen with
  `setUserNotificationSeen(input: { user_notification_id, seen })`.
- Channels are `email | discord | ws`. There is **no** mobile or web push.
- For five types (`projectnews`, `newtask`, `teamjoinedprogram`,
  `userjoinedproject`, `newproject`) the email channel is stripped server-side even
  if the user enabled it - the preferences screen must not promise email for those.
  Source: `backend/src/modules/notification/builders/notifications-builder.abstract.ts`.
- `updateUserSubscriptionToEventsWithChannels` **replaces** all preferences (delete
  then insert). Always send the complete set, never a delta, or the rest is
  silently wiped. Source: `backend/src/modules/notification/Notification.interactor.ts`.
- Preference reads go through `getUserNotificationPrefrences` /
  `updateUserNotificationPrefrences` (typo is the contract).

### Deep links generated by the backend

`Notification.redirect_url` is a **frontend route path** produced backend-side and
already present in sent emails. The paths in use:

```
/tasks/:taskId
/posts/:objectFeedId
/games/:projectSlug
/user_tasks/:id
/group_tasks/:id
```

Current state in `frontend/app/pages/`: `games/[gameId]` and `posts/` exist and must
not be renamed; `tasks/`, `user_tasks/`, and `group_tasks/` have no page, so those
links are dead today. The fix is adding those three routes (or one catch-all mapping
page), not renaming the two that work. Verify the full set the backend emits in
`backend/src/modules/notification/builders/`. See SKILL.md "Open questions" item 3.

## 9. Feed [CONTRACT]

- Pagination is offset/limit plus `before_feed_id`, with
  `sort_order: ObjectFeedSortOrder = pinned_first` by default.
- In `GetUserFeedsForProgramsProjectsAndHomePageInput`, `object_feed_channel_id`
  and `is_pinned` are `@deprecated` and explicitly ignored - do not send them
  expecting an effect.
- `ObjectFeed.mentions` and `ObjectFeedComment.mentions` are lists of `User` (or
  `PublicUser` in the public variants); `ObjectFeed.related_object: RelatedObject`
  is a concrete type, not a union.
- `ObjectFeed.files` is an N+1 - avoid it in large lists.

Source: `backend/src/modules/feed/Feed.schema.ts`,
`backend/src/modules/feed/Feed.resolvers.ts`.

## 10. Files [CONTRACT]

`type File` has no `id`; the key is `file_instance_id`. Only `malware_status` is
non-null. Always gate display and download on
`malware_status === 'NO_THREATS_FOUND'` - `file_url` is `null` until then, and
`NOT_SCANNED` means "still processing" (show a pending state and repoll), while
`THREATS_FOUND` / `UNSUPPORTED` / `FAILED` mean blocked. Upload recipes and limits
are in `reference-api.md` section 13. Source:
`backend/src/modules/file/File.schema.ts`,
`backend/src/modules/file/File.interactor.ts`.

## 11. Events and jobs [CONTRACT]

- The event module has its own naming: `events(options:)`, `eventById(id:)`,
  `eventByTitle(title:)`, `eventByUrl(url:)`,
  `eventInstances(eventId:, options:)`, `upcomingEventInstances`,
  `liveEventInstance`, `nextEventInstance`, `previousEventInstance`.
- `EventInstance.id: ID!` is a composite of `eventId` plus `start`, **not** a
  database id - do not treat it as a stable entity key across schedule changes.
- Two analytics systems sit on the livestream screen: `logEventLivestreamView`
  (GraphQL, with a dedupe hazard) and the Amplitude `Event: Video *` events. Both are
  in `reference-api.md` section 16.
- `job`, `jobs`, `jobCounts`, `jobScheduler`, `jobSchedulers` are administrative
  and cannot be used as progress indicators (`removeOnComplete: true` makes a
  finished job return `null`).

## 12. GitHub integration [CONTRACT]

`User.github_access_token` is exposed so the frontend can call the GitHub API on
the user's behalf; the token does not expire and there is no refresh. The backend
also keeps its own 60-second LRU cache of GitHub GET responses with ETag
conditional requests, so backend-served GitHub data can be up to a minute stale.
Source: `backend/README.md` "GitHub Support", `backend/src/modules/github/cache.ts`.

## 13. Environment and local development [CONTRACT]

- API GraphQL: `http://localhost:3003/graphql`; WebSocket
  `ws://localhost:3003/graphql`; account/OIDC server `http://localhost:3005`;
  frontend `http://localhost:3000`; health `GET http://localhost:3003/health`.
- Use the root scripts (`yarn start`, `yarn start-frontend [local|dev|staging]`) to
  point the frontend at a backend - they export the URLs as env vars, which take
  precedence over the frontend `.env`. Do not edit `frontend/.env` to switch
  backends. Source: root `README.md`, `backend/README.md`.
- Env variables the frontend uses, complete: `API_BASEURL` (also the `resource`
  value, must equal the backend's `API_URL` byte for byte - note
  `scripts/start-frontend.sh local` exports `http://127.0.0.1:3003` while the backend
  default is `http://localhost:3003`, and those two strings do not match),
  `GRAPHQL_BASEURL`, `GRAPHQL_WSBASEURL`, `ACCOUNT_URL`, `ACCOUNT_CLIENT_ID` (default
  `frontend`), `GRAPHQL_ENDSTAR_BASEURL` (a second, separate GraphQL endpoint whose
  operations are **not** in `backend/gql-schema.graphql` and cannot be validated
  against it), `AMPLITUDE_API_KEY` (absent means analytics silently no-ops), and
  `USE_MOCK_DATA` (compared against the string `'true'`, exposed as `useMockData`).
- **Bidirectional sync rule**: `frontend/nuxt.config.js` opens with "Keep in sync with
  .env.example" and `frontend/.env.example` with "Keep in sync with nuxt.config.js".
  Adding a variable to only one of them is a defect - the silent default in
  `nuxt.config.js` masks the omission.
- All of these reach the client through `runtimeConfig.public`, so they end up in the
  static bundle. Never put a secret in any of them. Endpoints live under
  `runtimeConfig.public.graphqlRequest` (`httpEndpoint`, `wsEndpoint`,
  `endstarHttpEndpoint`); there is also a leftover
  `runtimeConfig.public.axios.baseURL` pointing at the same `GRAPHQL_BASEURL` from the
  retired second HTTP client - do not replicate it.
- Backend ports and defaults: API/GraphQL `3003` (`API_PORT`), account/OIDC `3005`
  (`ACCOUNT_PORT`), `HOST_URL` default `http://localhost:3000`. Note
  `backend/.env.development.example` defines none of `API_URL`, `ACCOUNT_URL`,
  `HOST_URL`, or `ORIGIN_LIST`, so they all fall back to `backend/src/config.js`.
- The backend's `ORIGIN_LIST` (space-separated) controls CORS origins, falling back
  to `*` when unset. A new frontend domain needs that env updated wherever it is
  set. Source: `backend/src/server.ts`, `backend/src/config.js`.
- Shared dev environment notes: in Toolbx/Podman, `yarn` and `git commit` must run
  inside the container for the hooks to work. Source: root `README.md`.

## 14. Vocabulary

Use the backend's words in code, UI copy keys, and conversation. Mixed vocabulary
is the fastest way to lose the mapping between a screen and its contract.

| Domain term | Meaning | Note |
| --- | --- | --- |
| Project | A game/team workspace | Public route slug is `games` in the legacy URL scheme |
| Program | A course/initiative containing projects and cohorts | `Program.id` is nullable |
| Cohort | A time-boxed group inside a program | Roles 21/22, separate id space |
| Group | Generic membership container (`project`/`event`/`team`/`individual`) | No timestamps |
| Task / UserTask / GroupTask / TaskProgress | Work item and its per-user / per-group / historical progress | Status fields are `String` |
| Person | GitHub-linked contributor identity, distinct from `User` | `SafeInt!` id, no timestamps |
| ObjectFeed / ObjectFeedComment | Posts and comments | `Public*` variants exist |
| NewsFeed | Announcement content, separate from ObjectFeed | Distinct module |
| ObjectMaterial | Learning resource (video/image/file/link/article/slides/embed) | Has categories with `lang_id` |
| SignupCode | Enrollment code binding a user to program/project/cohort/institution | `already_claimed` on apply |
| Institution | Partner organization | Role 20 admin scope, no timestamps |
| SkillAchievement | Awarded skill | Use `person`, not the deprecated `learner` |
| UserProgramCertificate | Certificate | Public lookup via `getCertificateByPublicId` |
| Digital youth | Minor per k-ID classification | `age_category: digital_youth` |
| Restricted partner | Account under partner restrictions | `restricted_partner` permission reason |
| Read access | `open` / `restricted` visibility on objects and files | `ReadAccess` enum |
| Interactor | Backend logic plus data access layer | No service/DAO layer exists |
| Policy | Declarative ABAC rules per module | Default deny |
