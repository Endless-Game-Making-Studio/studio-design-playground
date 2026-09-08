# Reference: the GraphQL contract

Everything here is **[CONTRACT]** unless marked otherwise. Every claim names the
file to verify it in. The canonical file is `backend/gql-schema.graphql`; module
SDL fragments live in `backend/src/modules/<module>/<Entity>.schema.ts` and are
aggregated by `backend/src/graphql/schema.ts`.

Server shape: Apollo Server 3 (apollo-server-express) on `POST /graphql`, plus a
graphql-ws WebSocket server on the same path. `Query` has 137 fields, `Mutation`
195, `Subscription` 2. Source: `backend/src/server.ts`,
`backend/gql-schema.graphql`.

Local development: GraphQL API on `http://localhost:3003/graphql`, WebSocket on
`ws://localhost:3003/graphql`, account/OIDC server on `http://localhost:3005`,
health check on `GET http://localhost:3003/health`. Source: `backend/src/config.js`,
`backend/README.md`.

## 1. Naming

### Queries

- 115 of 137 use the `get` + PascalCase entity prefix: `getProjectById`,
  `getUsers`, `getTeamMembers`.
- Two use `list`: `listGitHubPullRequestContributions`, `listSkillAchievements`.
- 20 have **no prefix**, all in newer modules (event, job, parental-consent, plus
  a few one-offs): `me`, `check`, `verifySignupCode`, `userReport2`,
  `intakeFormReport`, `eventById`, `eventByTitle`, `eventByUrl`, `events`,
  `eventInstances`, `upcomingEventInstances`, `liveEventInstance`,
  `nextEventInstance`, `previousEventInstance`, `job`, `jobs`, `jobCounts`,
  `jobScheduler`, `jobSchedulers`, `myParentalConsentChallenge`.
- Plural means list, singular means one item, and the suffix names the lookup key:
  `getProjects` vs `getProjectById` / `getProjectBySlug` / `getProject` (which
  accepts either `project_id` or `slug`).
- Counts are separate fields or queries with a `Count` / `_count` suffix:
  `participants_count`, `members_count`, `tasks_count`, `comment_count`.

Source: `backend/gql-schema.graphql` `type Query`.

### Mutations

- Verb-first camelCase. CRUD is `create*` / `update*` / `delete*`; relationships
  are `add*` / `remove*`.
- Domain actions use explicit opposites: `joinProject`/`unjoinProject`,
  `likeProject`/`unlikeProject`, `flagObjectFeed`/`unflagObjectFeed`,
  `saveObjectMaterialForLater`/`unsaveObjectMaterial`,
  `assignTaskToMyself`/`unassignTaskFromMyself`,
  `dismissGitHubPullRequest`/`undismissGitHubPullRequest`.
- Irregular casing to copy exactly: `unMuteObjectNotifications` and
  `unMuteAllObjectNotifications` (capital `M`), next to the regular
  `muteObjectNotifications` and `unsubscribeToObjectNotifications`.
- Worse, the input type **inverts** the mutation's capitalization:
  `unMuteObjectNotifications(input: UnmuteObjectNotificationsInput)` - capital `M` on
  the mutation, lowercase `m` on the input type. Compare
  `unsubscribeToObjectNotifications(input: UnsubscribeToObjectNotificationsInput)`,
  which is consistent. Any variable or codegen name derived by inference breaks here.

Source: `backend/gql-schema.graphql` `type Mutation`.

### Frozen typos - copy verbatim, never "fix"

`getUserNotificationPrefrences`, `updateUserNotificationPrefrences`,
`GetUserNotificationPrefrencesInput`, `UpdateUserNotificationPrefrencesInput`
(missing an `e`); `FileMetadataForReachText` (should be RichText);
`GetgetUserDataByUsernameOrEmailInput` ("Getget");
`getUserAnswersByQuizIdInput` and `specifyProjectToTeamProgramInput`
(input types starting lowercase); `type userProgramIdWithProgram` (type starting
lowercase); `GroupTask.group_task_id_status_id`; `Project.likes_counter` (not
`likes_count`). Source: `backend/gql-schema.graphql`.

## 2. Arguments

- 189 of 195 mutations take exactly one argument named `input`. The six
  exceptions: `logout`, `muteAllObjectNotifications`,
  `unMuteAllObjectNotifications`, `resetUnreadNotificationsCount`,
  `requestParentalConsent` (no arguments) and
  `sendParentalConsentEmail(email: String!)`.
- Queries mostly use `input` too. The event module is the exception: it uses
  `options` for paging/filtering and bare scalars for keys, across all nine queries.
  Note that the scalar key is named `id` in `eventById` but `eventId` (camelCase) in
  every instance query, and `liveEventInstance` has a bare scalar and **no**
  `options`:

  ```graphql
  eventById(id: SafeInt!): Event
  eventByTitle(title: String!): Event
  eventByUrl(url: URLStr!): Event
  events(options: EventsOptions): [Event!]!
  eventInstances(eventId: SafeInt!, options: EventInstancesOptions): [EventInstance!]!
  upcomingEventInstances(options: UpcomingEventInstancesOptions): [EventInstance!]!
  liveEventInstance(eventId: SafeInt!): EventInstance
  nextEventInstance(eventId: SafeInt!, options: NextEventInstanceOptions): EventInstance
  previousEventInstance(eventId: SafeInt!, options: PreviousEventInstanceOptions): EventInstance
  ```

  Outside the event module the only bare-scalar query is
  `verifySignupCode(code: String!)`.
- Type fields can take their own argument, sometimes named `input` even when the
  type is `*Options`: `User.certificates(input: CertificatesOptions)`.

Why the name matters: `backend/src/graphql/directives.ts` destructures
`const { input: object } = args` and passes that object to the ABAC policy engine.
An argument under any other name is invisible to authorization.

Source: `backend/gql-schema.graphql`, `backend/src/graphql/directives.ts`.

## 3. Return shapes

- Create/update return the entity, usually non-null: `createProject: Project!`,
  `updateUser: User!`, `createCohort: Cohort!`.
- Deletes return `Void` (82 mutations) or `Boolean!` (13), and three mutations
  return **nullable** `Boolean`: `toggleUserVerified(input: ToggleUserVerifiedInput)`,
  `deleteSkillAchievement(input: DeleteSkillAchievementInput!)`, and
  `removeJobScheduler(input: RemoveJobSchedulerInput!)`. For those three, `null` is
  not documented success - it is ambiguous, so treat it as failure or inspect
  `errors[]`. This is the one place the "Void means success" rule does not transfer:
  of the 37 `delete*` mutations, only `deleteSkillAchievement` is in this group.
- There is exactly one legacy payload wrapper:
  `CreateUsersFromCSVFileResponse { success, message, users, errors: [FieldError!] }`.
  Do not model the rest of the API after it.
- `Void` always serializes to `null` (`serialize() { return null; }`), so a `null`
  result is success. Source: `backend/src/graphql/scalars.ts`.
- The two unions in the schema are visibility unions, not error unions:
  `UserResult = User | LimitedUser`, `UserProfileResult = UserProfile | LimitedUserProfile`.

Source: `backend/gql-schema.graphql`, `backend/src/modules/user/User.schema.ts`.

## 4. Errors

### Codes

`backend/src/errors.ts` defines `HTTP_STATUS_MAP`:

| `extensions.code` | HTTP | Meaning for the UI |
| --- | --- | --- |
| `BAD_USER_INPUT` | 400 | Validation - show per-field errors |
| `UNAUTHENTICATED` | 401 | Token missing/invalid/expired/revoked - refresh, then login |
| `FORBIDDEN` | 403 | Policy denial (`Forbidden`) or disabled account (`User disabled`) |
| `NOT_FOUND` | 404 | Mutation on a resource that does not exist |
| `CONFLICT` | 409 | Uniqueness conflict (only project slug is handled today) |
| `LIMIT_EXCEEDED` | 429 | Business cap reached - never retry |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected; also the fallback for uncoded errors |

Three distinct auth failures with different UI handling
(`backend/src/graphql/directives.ts`, `backend/src/auth/tokens.ts`):

- `UNAUTHENTICATED` "Not authenticated" - try refresh, then send to login.
- `FORBIDDEN` "User disabled" - force logout; every request will fail.
- `FORBIDDEN` "Forbidden" - ABAC denial; hide the action, do not retry.

Two more codes exist only on the server-to-server path and should never be seen from a
browser, but explain what `x-api-key` actually does. The key authenticates a synthetic
user `{ id: -1, username: '-egs-api-key-user', _isApiKeyUser: true }`
(`backend/src/server.ts:281-296`). That is **not** a blanket ABAC bypass:
`backend/src/graphql/directives.ts:45-58` throws
`FORBIDDEN 'API key authentication not allowed for this operation'` on every field
that does not declare `allowApiKey` or `requireApiKey`, and only skips policy
evaluation on those opt-in fields. Fields marked `requireApiKey` reject a normal user
token with `UNAUTHENTICATED 'API key required for this operation'`. The directive is
`@auth(action: String, allowApiKey: Boolean, requireApiKey: Boolean)`.

### `extensions.detail`

Business sub-codes seen in the code today: `USER_EMAIL_DUPLICATE`,
`USER_USERNAME_DUPLICATE`, `USER_EMAIL_NOT_ALLOWED`, `INVALID_LOGIN`,
`INVALID_PWRESET_CODE`, `DUPLICATE_CODE`, `EXTERNAL_URL_ADMIN_ONLY`,
`ONE_OF_FILE_OR_URL`. They are the only way to distinguish, for example,
"duplicate email" from "duplicate username" inside one `BAD_USER_INPUT`. Source:
`backend/src/modules/user/User.interactor.ts`,
`backend/src/modules/signupcode/SignupCode.interactor.ts`,
`backend/src/modules/project/Project.interactor.ts`.

### `extensions.issues`

Modules using zod (`event`, `file`) attach the full zod issue array and format the
message as `path: message`. Everything else throws a single-message
`UserInputError` with no path. Support both. Source:
`backend/src/utils/validation.ts`.

### HTTP status coupling

`backend/src/graphql/plugins.ts` rewrites the HTTP status from the **first** error
only (with an explicit "For now only the first error is considered" comment) and
forces uncoded errors to `INTERNAL_SERVER_ERROR`. A response can therefore carry
valid partial `data` under a 401/403/404/500. The transport must read the body
regardless of status.

### Never display `message`

Roughly 320 throw sites use literal English with internal detail (for example
`Project 42 should have group_id set`, `expected exactly one row, received 3`).
The backend's i18n system covers notifications and emails, not API errors. Map
code plus detail to a localized string in the frontend. Source:
`backend/src/modules/project/Project.interactor.ts`,
`backend/src/common/language/constants.en.ts`.

## 5. Scalars

Source: `backend/src/graphql/scalars.ts`, `backend/gql-schema.graphql`.

| Scalar | Contract |
| --- | --- |
| `DateStr` | `YYYY-MM-DD`, no time, no timezone (avoids a real birthday off-by-one) |
| `DateTimeStr` | ISO 8601 UTC; on **input** the string must end with `Z`, an offset throws `TypeError` |
| `Void` | Always serializes to `null`; never write a sub-selection |
| `JSON` | Arbitrary object, untyped |
| `SafeInt` | Integer within +/-(2^53-1), arrives as a JS number |
| `URLStr` | Empty string is normalized to `null` in both directions |
| `Upload` | graphql-upload-minimal multipart; used by only two operations |

## 6. Enums

Dominant convention is lowercase snake_case. Verify each one - the separator is
not consistent even between sibling enums.

```
ProjectStatus            draft published inreview complete showcase unlisted archived hidden
ProgramStatus            draft notstarted inprogress completed hidden archived
CohortStatus             not_started in_progress completed
UserTaskStatus           draft assigned unassigned inprogress needhelp inreview testing complete
AgeCategory              digital_youth adult
Language                 en es
ReadAccess               open restricted
PaceType                 selfpaced setpaced
AuthMethod               password google microsoft github
GroupType                project event team individual
ProjectApplicationStatus new approved declined
ObjectMaterialType       video image file link article slides embed
NotificationChannel      email discord ws
```

Note `ProgramStatus` uses `notstarted`/`inprogress` while `CohortStatus` uses
`not_started`/`in_progress`.

The five uppercase exceptions:

```
MalwareStatus            NOT_SCANNED NO_THREATS_FOUND THREATS_FOUND UNSUPPORTED FAILED
Like                     THUMBS_UP THUMBS_DOWN LAUGH HOORAY CONFUSED HEART ROCKET
TaskModes                ONLY_ACTIVE ONLY_NOT_ACTIVE ACTIVE_OR_DONE ALL
GitHubPullRequestStatus  PENDING ASSIGNED DISMISSED
ParentalConsentResult    PASS FAIL IN_PROGRESS
```

`NotificationType` has 18 values, mostly lowercase with no separator
(`newtask`, `newproject`, `taskapproved`, `certificateawarded`, ...) and **two**
with underscores: `new_object_feed_mention_added`,
`new_object_feed_comment_mention_added`. Any rule-based mapping breaks on those
two.

Status fields are `String`, not enums: `Project.status_id`, `Task.status_id`,
`UserTask.user_task_status_id`, `GroupTask.group_task_id_status_id`,
`TaskProgress.user_task_status_id`, `UserProgram.pace_type`,
`CohortUser.pace_type_id`. The enums appear in filter inputs
(`ProjectsFilter.statuses: [ProjectStatus]`) and on
`Program.program_status_id: ProgramStatus` (**nullable**, :2543) and
`Cohort.cohort_status: CohortStatus!` (**non-null**, :940). The nullable
`cohort_status` is on `CohortUser` (:1009). The contrast matters: optional chaining is
wrong on one and required on the other.

Source: `backend/gql-schema.graphql` enum blocks;
`backend/src/modules/file/File.schema.ts`;
`backend/src/modules/task/Task.schema.ts`.

## 7. Field naming and ids

Data fields are `snake_case` because they are Postgres columns and there is no
case conversion layer (`backend/knexfile.js` defines neither
`postProcessResponse` nor `wrapIdentifier`). A minority are camelCase and must be
copied as-is:

```
pageInfo totalCount hasNextPage hasPreviousPage startCursor endCursor
numberOfUsers joinedProjectsCount certificatesCount taskProgressLog
otpExpiresMinutes challengeId oneTimePassword otpExpiresAt
newsFeeds memberOfProjects leaderForProjects mentorForProjects adminForPrograms
imageFile thumbnailImageFile coverImageFile logoFile
projectFilter projectSorting firstDueDate attachedFiles attachedLinks
isMentor programs_i_havent_joined
```

Id and timestamp shapes differ per type - check before typing or routing:

```
User.id: Int!            created_at/updated_at/last_activity_at: DateTimeStr!
Project.id: Int!         created_at/updated_at: DateTimeStr (nullable)
Task.id: Int!            created_at/updated_at, due_date: DateTimeStr
Program.id: Int          (NULLABLE)  created_at/updated_at: DateTimeStr!
Group.id: Int!           no timestamps at all
Institution.id: Int      no timestamps
Notification.id: Int     sent_date: DateTimeStr
Cohort.id: SafeInt!      created_at/updated_at: DateTimeStr!
Person.id: SafeInt!      no timestamps
Event.id: SafeInt!
EventInstance.id: ID!    composite of eventId + start, NOT a database id
Job.id: String            (NULLABLE - the only String id in the schema)
```

Ids are globally unique across domains because most primary keys are foreign keys
into the shared `object` table, so a project id can never equal a task id. Do not
assume ids are dense or start at 1 per entity. Source: `backend/db-schema.txt`.

Media/avatar paths differ by type:

- `User.metadata.image_url`, `User.metadata.cover_image_url`
- `PublicUser.metadata.image_url` (only field on `PublicUserMetadata`)
- `UserProfile.image_url` / `cover_image_url` and `LimitedUserProfile.image_url`
  are **top level**
- `Project.image_url`, `Project.thumbnail_image_url`, plus `video`, `play_url`
- `Program.image_url`, `Program.logo_url`
- `ObjectMaterial.image_url: URLStr`, `video_url: URLStr`, `link: URLStr`,
  `file: File`

Source: `backend/gql-schema.graphql`.

## 8. Media URLs

All media URLs handed to the frontend are absolute, public CDN URLs with no
signature and no expiry: `https://<CDN_DOMAIN or S3_BUCKET_DOMAIN>/<encoded key>`.
The helper named `secureSignURL` does **not** sign anything - it delegates to
`cdnUrlForPath`. Do not prefix, re-sign, or treat them as expiring. Source:
`backend/src/fileupload/index.ts`.

Every S3 object carries `Content-Disposition: attachment; filename="<name>"`, so
opening `file_url` in a tab downloads rather than previews. Use an image element
for previews. Source: `backend/src/modules/file/File.interactor.ts`,
`backend/src/jobs/processors/file-content-disposition.ts`.

## 9. Pagination

### offset/limit (dominant)

```graphql
query Projects($input: GetProjectsInput) {
  getProjects(input: $input) { id name slug status_id }
}
```

```json
{ "input": { "offset": 0, "limit": 20,
             "projectSorting": { "field": "likes_counter", "order": "asc" } } }
```

- `projectSorting` is mandatory in practice: `getProjects` only applies `orderBy`
  when it is present, so paging without it duplicates and drops rows. Source:
  `backend/src/modules/project/Project.interactor.ts`.
- **`ProjectOrderFields` admits only `likes_counter` and `feedbacks_count`.** You
  cannot sort `getProjects` by `name`, `created_at`, or `id`; `field: name` fails
  GraphQL validation before it reaches the resolver.
  (`backend/gql-schema.graphql:1267-1279`, `:1295-1300`.)
- Sorting has **four** shapes, not one, and the wrapper argument is named
  differently in each place:

  | Operation | Argument | Shape |
  | --- | --- | --- |
  | `getProjects` | `projectSorting` | `ProjectOrderBy { field: ProjectOrderFields, order: ProjectSortingOrder }` - both nullable, no default |
  | TaskProgress lists | `order_by` | `TaskProgressOrderBy { field: TaskProgressOrderField!, order: TaskProgressSortingOrder = asc }` |
  | Program participants | `order_by` | `ProgramParticipantsOrderBy { field: ProgramParticipantsOrderField!, order: ProgramParticipantsSortingOrder = asc }` |
  | `User.certificates` | `orderBy` **and** `order` | `CertificatesOptions` is **flat** - `orderBy: CertificateOrderField` (`id` \| `created_at`) and `order: CertificateSortingOrder` are siblings, not nested |

  `ProjectOrderBy`, `TaskProgressOrderBy`, and `ProgramParticipantsOrderBy` are
  **input types**, not enums; the enums are the `*OrderField(s)` and `*SortingOrder`
  pairs (note the inconsistent singular `Field` / plural `Fields`). There is no
  `"name_ASC"` string form. Source: `backend/gql-schema.graphql:1277, 1683, 2606,
  3369-3384`.
- There is no `page`/`perPage` anywhere.
- Type-level list fields take their own limit/filter input:
  `Project.newsFeeds(input: NewsFeedsFilter)`,
  `Project.materials(input: ObjectMaterialsFilter)`,
  `Program.projects(input: GetProjectsInput)`,
  `Program.participants(input: ProgramParticipantsInput)`,
  `Cohort.participants(input: CohortParticipantsInput)`,
  `User.memberOfProjects(input: UserProjectsInput)`,
  `User.certificates(input: CertificatesOptions)`.

### cursor (six fields)

```graphql
query Contributions($input: ListGitHubPullRequestContributionsInput) {
  listGitHubPullRequestContributions(input: $input) {
    totalCount
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    data { id }
  }
}
```

```json
{ "input": { "pagination": { "first": 20, "after": "<endCursor>" } } }
```

- Paginated types are `PaginatedGitHubPullRequests` and
  `PaginatedGitHubPullRequestContributions`, returned by **six** fields:
  `Query.listGitHubPullRequestContributions` (:141), `User.contributions` (:569),
  `Project.pull_requests` (:1088), `GitHubPullRequestContributor.contributions`
  (:3776), `GitHubPullRequest.contributions` (:3830), `Person.contributions` (:4036).
  The cursor **input** has three separate doors -
  `ListGitHubPullRequestContributionsInput.pagination`,
  `GitHubPullRequestContributionsFilter.pagination`, and
  `ProjectPullRequestsFilter.pagination` (:1445, :3848, :3889) - which is probably
  where an earlier "three" came from.
- Read `data`, not `edges { node }`. There are no `*Connection` types.
- Rules from `backend/src/common/pagination.ts`: `first`/`last` default to 10 when
  both are omitted; combining `after`/`first` with `before`/`last` throws
  `UserInputError`; negative `first`/`last` throws. Cursors are opaque base64url
  JSON - never build or parse one client-side.
- **`after`/`before` mean different things in different inputs.** In
  `PaginatedDataInput` they are opaque cursor `String`s. In `EventInstancesOptions`,
  `UpcomingEventInstancesOptions`, `NextEventInstanceOptions`, and
  `PreviousEventInstanceOptions` they are `DateTimeStr` range bounds (with an
  `inclusive: Boolean` beside them), and those inputs paginate by `offset`/`limit`,
  not by cursor. Passing an `endCursor` there throws in the scalar parser.
- `PageInfo` has exactly `hasNextPage: Boolean!`, `hasPreviousPage: Boolean!`,
  `startCursor: String`, `endCursor: String`.

## 10. Unions and `__typename`

```graphql
query UserByUsername($input: UsernameInput!) {
  getUserByUsername(input: $input) {
    __typename
    ... on User { id username email metadata { image_url } }
    ... on LimitedUser { id username public metadata { image_url } }
  }
}
```

`LimitedUser` exposes only `id`, `username`, `public`,
`metadata: PublicUserMetadata!`. `LimitedUserProfile` exposes only `id`, `username`,
`image_url`.

The full type is the **common** case, not the exception. `canViewFullProfile`
(`backend/src/modules/user/User.interactor.ts:222-235`) returns true when
`user.public === true` - for any viewer, including anonymous - and otherwise when the
viewer is the owner, a system admin (`role_ids` includes 1), or an institution admin
of the owner's institution. Only a viewer looking at a profile whose `public` is
`false`/`null`, without one of those relationships, gets the limited type.

Even on the full type some fields are nulled per viewer by resolver:
`User.email`, `User.location`, `User.metadata.birthday`,
`User.metadata.discord_username`, plus `github_access_token` (owner only). Do not
generalize from that to "the rest of `User` is safe": `last_name` is **not** nulled,
and `getProfileForUser` has no `@auth` at all. See `reference-domain.md` section 6.

## 11. Public (unauthenticated) surface

Root fields without `@auth` that can drive public pages:
`getPublicProjects`, `getPublicProject`, `getPublicProjectById`,
`getPublicProjectBySlug`, `getPublicPrograms`, `getPublicProgramById`,
`getPublicNewsFeedById`, `getPublicObjectFeeds`, `getPublicObjectFeedComments`,
`getPublicObjectMaterialCategories`, `getPublicObjectMaterialById`,
`getPublicPagesByName`, `getPublicFileInstanceById`, `getProfileForUser`,
`getCertificateByPublicId`, `verifySignupCode`, `check`.

The `Public*` types have fewer fields and are not interchangeable with the
authenticated types. `PublicUser` has only `id`, `username`, `roles`,
`metadata: PublicUserMetadata!` (which has only `image_url`), and `role_ids`.
`PublicProject` drops all viewer-dependent fields (`is_member`, `is_leader`,
`is_mentor`, `is_joined`, `has_applied`, `project_applications`,
`skill_achievements`, `cohort`, `pull_requests`) and its `permissions` is
documented as always restrictive.

Anonymous viewers also see fewer **rows**: profiles are filtered to
`user.public = true`, and `digital_youth` users without parental consent are
excluded for any viewer that is not an admin or the user themselves. Member counts
and user lists may therefore be incomplete without any error. Source:
`backend/src/modules/user/User.interactor.ts`,
`backend/src/modules/project/Project.schema.ts`.

Verify case by case rather than by name: `getSignupCodes` has no `@auth` while
`getSignupCodeWithIdAndEntityId` does. See SKILL.md "Open questions" item 4.

## 12. Subscriptions

```graphql
type Subscription {
  subscribeAllNotifications(input: SubscribeAllNotificationsInput): SubscribedNotification
  myParentalConsentStatus: ParentalConsentStatusUpdate!
}
```

- Transport: graphql-ws on `/graphql`, `connectionParams.Authorization =
  'Bearer <token>'`, key with a capital `A` (graphql-ws does not normalize
  connection params the way HTTP headers are normalized). No valid user means the
  **connection** is rejected, not just the field. Recreate the client when the
  token changes. Source: `backend/src/server.ts`.
- `subscribeAllNotifications` requires
  `input.notification_types: [NotificationType!]!`. Types outside that list are
  dropped server-side, and an empty list receives nothing. A second server-side
  filter also requires the type to be in the user's subscribed `ws` channels.
  Source: `backend/src/modules/notification/filters/`.
- The payload is `SubscribedNotification { notification, unread_notifications_count }`
  so the badge count needs no extra query.
- The pushed notification is **not translated** - it is built with the default
  system language (English). Refetch `getUserNotifications` (or keep a local
  dictionary keyed by notification type) if the UI needs the user's language.
  Source: `backend/src/modules/notification/builders/notifications-builder.abstract.ts`.

## 13. Upload

### Presigned S3 POST (real files) - three mandatory steps

```graphql
mutation CreateFileUploadLink($input: CreateFileUploadLinkInput) {
  createFileUploadLink(input: $input) {
    secure_upload_url
    additional_s3_security_fields
    file_id
    file_instance_id
  }
}
```

1. Call `createFileUploadLink(input: { name, mime_type, size, folder })`.
2. `POST` `multipart/form-data` straight to `secure_upload_url`, appending every
   pair from `JSON.parse(additional_s3_security_fields)` **first** and the `file`
   field **last**. S3 answers `204` on success.
3. Call `markFileInstanceUploaded(input: { file_instance_id, read_access })`.

Rules:

- The presigned POST expires after 600 seconds. On failure or expiry, request a
  new link - do not retry the old URL. Source: `backend/src/fileupload/index.ts`.
- `size` must be a positive integer, max `5_368_709_120` bytes (5 GB). Missing or
  `0` fails zod validation with `BAD_USER_INPUT`, despite `size: Int` being
  nullable in the SDL. Source: `backend/src/modules/file/File.interactor.ts`,
  `backend/src/modules/file/File.model.ts`.
- There is **no MIME allowlist server-side**. `mime_type` is stored as sent and
  reinjected as the S3 `Content-Type`, so type validation is entirely the
  frontend's job.
- Filenames are sanitized per key segment and reject slashes, `: * ? " < > |`,
  Windows reserved names, and trailing dot/space with
  `UserInputError('Invalid filename')`. Sanitize before sending. Source:
  `backend/src/fileupload/index.ts`.
- `markFileInstanceUploaded` defaults `read_access` to `open`. Send `restricted`
  explicitly for non-public files.
- Skipping step 3 leaves the file orphaned and never marked uploaded.

### Malware scan gate

`File.malware_status: MalwareStatus!` defaults to `NOT_SCANNED` and
`File.file_url` stays `null` until the scan reports `NO_THREATS_FOUND`. Nothing
notifies the client - there is no subscription, notification, or progress field -
so the UI needs a pending state and a backoff repoll of
`getFileInstanceById` / `getFileInstanceByIdAuthenticated`. The job queue
(`removeOnComplete: true`) cannot be used as progress: a finished job returns
`null`. Source: `backend/src/modules/file/File.interactor.ts`,
`backend/src/jobs/processors/malware-scan-result.ts`, `backend/src/jobs/queue.ts`.

`type File` has no `id`; the key is `file_instance_id`. Every field except
`malware_status` is nullable, and `external_link` is `@deprecated` and always
`null`.

### Inline base64 data URL (`imageFile` and friends)

Many create/update inputs accept the image inline in a plain `String` field.
`imageFile: String` appears in **21 inputs**: `UserMetadataInput` (the avatar path,
via `updateUser`), `Create`/`UpdateProjectInput`, `Create`/`UpdateTaskInput`,
`Create`/`UpdateNewsFeedInput`, `Create`/`UpdateRoadmapInput`,
`Create`/`UpdateNotificationInput`, `Create`/`UpdateProgramInput`,
`Create`/`UpdateObjectFeedInput`, `Create`/`UpdateObjectFeedCommentInput`,
`Create`/`UpdateObjectMaterialInput`, `Create`/`UpdateQuizInput`.

Its companions are narrower than they look: `thumbnailImageFile` exists **only** on
`Create`/`UpdateProjectInput`; `coverImageFile` **only** on `UserMetadataInput`
(one occurrence in the whole schema, :773); `logoFile` **only** on
`Create`/`UpdateProgramInput` (:2683, :2704). There is no project or task
`coverImageFile` and no project `logoFile`. Careful with `Roadmap.imageFile`, which is
`Int` on the **type** (the id of an already-saved file) while the roadmap **inputs**
take `String`.

The value must be a full data URL:
`data:<mime>;base64,<payload>`. The backend validates the prefix with
`/^data:([^;]*);base64$/i` and throws
`UserInputError('Upload file invalid format')` otherwise. Source:
`backend/src/fileupload/index.ts`.

### True multipart (`Upload` scalar) - two operations only

`uploadBase64File(input: { name, mime_type, base64_content: Upload, folder })` and
`createUsersFromCSVFile(input: { file: Upload!, ... })`. Server limits:
`maxFileSize` 50 MB, `maxFiles` 20 per request, JSON body limit 50 MB (base64
inflates roughly 33%). For `uploadBase64File` the multipart part must contain the
**text** of the data URL, not raw bytes; the response
`FileMetadataForReachText` includes a ready-to-insert `img_tag` and exposes no
`region` field. Source: `backend/src/server.ts`,
`backend/src/modules/file/File.interactor.ts`,
`backend/src/modules/file/File.schema.ts`.

## 14. i18n

- Only `en` and `es` exist (`enum Language { en es }`).
- The GraphQL API accepts **no** `Accept-Language` header (CORS blocks it) and no
  language argument. The server reads
  `context.user.metadata.preferred_lang_id` with fallback `'en'`. Change the
  language by updating `metadata.preferred_lang_id` via `updateUser` and refetch.
  Anonymous requests always get English. Source:
  `backend/src/utils/getPreferredLanguageIdFromContext.ts`.
- The account/OIDC server *does* honor `Accept-Language`, with precedence
  `?lang=` in the URL, then the user preference, then session, then header. Deep
  links into the account server should propagate `?lang=`. Source:
  `backend/src/account/i18n.ts`.
- The backend returns **already-translated text**, never keys. `ln_<field>` jsonb
  columns are resolved onto the base field before serialization, so the client
  receives `name`, never `ln_name`. Some types do expose `ln_*: JSON` maps
  (`Institution`, `Interest`, `Quiz`, `Question`, `AnswerOption`,
  `ObjectMaterialCategory`) - verify per type in the schema. Source:
  `backend/src/utils/replaceLangageSpecificFieldsWithTranslation.ts`.

## 15. Auth-related operations

- Token sources: `loginWithUsernameOrEmail` returns `String` (legacy path),
  `createUserWithSignupCode` returns `String!`, `verifyUser` returns `String!`.
  The current path is OIDC via the account server; the API server's
  `/auth/<provider>` flow (token in a `sessionId` query param) is documented as
  deprecated. Source: `backend/README.md` "Acquiring Tokens".
- Password reset: `sendPasswordReset(input: { login, resetUrl, options: { loginParam, codeParam } }): String!`
  then `applyPasswordReset(input: { login, code, newPassword }): User!`.
  `resetUserPassword` is `@deprecated`.
  **The `String!` returned by `sendPasswordReset` is the reset code itself** -
  never display, log, or persist it. The email link is `resetUrl` plus
  `?login=<username>&code=<code>` (parameter names overridable via `options`), so
  the frontend reset route must read exactly those params. Source:
  `backend/src/utils/pwreset.ts`.
- OTP / signup: `resendOTP` and `resendOTPForCurrentUser` return `Void`;
  `updateEmailForCurrentUser` returns `OtpRequestResult { otpExpiresMinutes: Int! }`
  (use it for the resend countdown);
  `applySignupCodeForCurrentUser(input: { signupCode })` returns
  `ApplySignupCodeResult` including `already_claimed: Boolean!` - check it so
  success is not shown twice.
- OTP and reset codes are 4 digits with a 10-minute TTL, and the backend enforces
  **no resend cooldown**. Debounce/disable the resend control client-side and show
  the validity window. Source:
  `backend/src/modules/signupcode/SignupCode.interactor.ts`,
  `backend/src/utils/pwreset.ts`.
- Linking an external provider to a logged-in account: redirect to
  `{ACCOUNT_URL}/auth/connect/{google|microsoft|github}?client_id=frontend&redirect_uri=<return url>`.
  Here the `redirect_uri` is validated by **origin**, not exact path. Failure
  returns `?error=<message>`. Source: `backend/src/account/routes/auth.ts`.
- Client-side credential validation should mirror the backend's zod rules:
  username 3-30 chars `[a-zA-Z0-9_-]`; password 8-128 chars with at least one
  uppercase, one number, one symbol; email max 255; OTP exactly 4 digits; name max
  100. Source: `backend/src/utils/validation.ts`.

## 16. Analytics and logging

- The frontend does **not** emit activity events. Every query and mutation is
  logged automatically (operation name, arguments, duration, error, user id), and
  `last_activity_at` is updated on every authenticated operation. Source:
  `backend/src/graphql/middleware.ts`.
- The only analytics event the frontend sends **through GraphQL** is
  `logEventLivestreamView(input: { event_id: SafeInt! }): Boolean! @auth` (product
  events go to Amplitude, below). It
  inserts a row per call with **no dedupe and no unique index**, so guard against
  re-render, strict-mode double-invoke, and player reconnects. Source:
  `backend/src/modules/event/Event.interactor.ts`, `backend/db-schema.txt`.
- `activity_log` persists the arguments of **every query and mutation** for 90 days,
  including unauthenticated ones (`backend/src/graphql/middleware.ts` logs whenever
  `fieldType` is `Query` or `Mutation`, with no auth check). The sanitizer removes only
  the keys `imageFile`, `thumbnailImageFile`, and `password`, and only at the **first
  level** of `input` - `cleanParam` iterates `Object.keys(param)` and is not
  recursive, so a secret nested at `input.options.password` survives.
  Already-existing consequences: `applyPasswordReset(input: { login, code, newPassword })`
  writes `newPassword` in the clear alongside `code`, and
  `sendParentalConsentEmail(email:)` writes the trusted adult's address. Treat this as
  a known backend limitation: record the dependency before building the reset form,
  and keep those values out of frontend logging and telemetry as well. Source:
  `backend/src/modules/activitylog/ActivityLog.interactor.ts:10, 148-170`,
  `backend/src/graphql/middleware.ts:83-107`,
  `backend/src/jobs/processors/activity-log-purge.ts`.
- Errors in production and staging are posted to Slack (except "Not
  authenticated"). Aggressive retries or short polling create noise and alerts.
  Source: `backend/src/graphql/middleware.ts`.

### Amplitude (product analytics) - a second, separate channel

The frontend also emits product events to Amplitude, in parallel with the backend
activity log. This is a contract with an external system: renaming events breaks
existing dashboards, not the build. Source: `frontend/app/plugins/amplitude.js`.

- Enabled by `AMPLITUDE_API_KEY` -> `runtimeConfig.public.amplitudeApiKey`. Without
  the key the plugin registers a no-op `$amplitude` and warns in the console, so
  analytics disappears silently while the app keeps working.
- The plugin declares `dependsOn: ['auth']` and calls
  ``amplitude.setUserId(`user-${userData.id}`)`` while watching `$auth.userData`
  (`null` when logged out). Keeping the `user-` prefix is what preserves historical
  user identity.
- `autocapture.pageViews` is **off on purpose**. Page views fire from
  `nuxtApp.hook('page:finish')` inside a `nextTick` so the final `<title>` lands in
  the event. Re-enabling autocapture double-counts page views.
- `Page Exit` fires from `router.beforeEach` and from `visibilitychange`, switching to
  `setTransport('beacon')` plus `flush()` when the tab is hidden (normal requests are
  killed at browser shutdown). Emitting only on unload loses events.
- Event names in use, to preserve or migrate deliberately:
  `[Amplitude] Page Viewed`, `Page Exit` (with `Time on page` in seconds and
  `Reason`), `Event: Video Play` / `Event: Video Pause` / `Event: Video End`,
  `Project joined`.
- `logEventLivestreamView` (GraphQL) and `Event: Video *` (Amplitude) are two systems
  on the same screen; the no-dedupe rule above applies to the first.

## 17. Caching

There is no HTTP cache policy on `/graphql`: no `Cache-Control`, no `ETag`, no
`@cacheControl`. All caching is the client's responsibility. The backend's Redis
is internal (pubsub, session, OTP, WS channel cache, k-ID challenge) and invisible
to the frontend. Source: `backend/src/cache/index.ts`,
`backend/src/graphql/plugins.ts`.

## 18. Async work with no synchronous result

Operations that return before their side effect completes, so the UI needs a
pending state (BullMQ queue `es`, `removeOnComplete: true`):

- Malware scan of an uploaded file (`file_url` appears later).
- Email and Discord delivery of notifications.
- Feed post/comment creation - queues Coop moderation (5 attempts, exponential
  backoff) and Act Two webhooks after commit.
- Flagging a post.
- User create/update and program enrollment (EGS/Act Two sync webhooks).

Source: `backend/src/jobs/worker.ts`, `backend/src/modules/feed/Feed.interactor.ts`,
`backend/src/modules/user/User.interactor.ts`.

`notifyUsersAbout*` on the backend is wrapped in try/catch with `console.error`, so
a notification can fail silently while the mutation succeeds. Do not assume a
notification went out.

## 19. Declared but dead

Fields and queries present in the schema that do not work. Do not build on them:

| Symbol | Reality | Source |
| --- | --- | --- |
| `getFilesForTaskProgress` | Declared with `@auth` and a policy but has no resolver - always `null` | `backend/src/modules/file/File.resolvers.ts` |
| `Notification.meta_data: JSON` | Never populated (no column; the setter is a no-op) - always `null` | `backend/src/modules/notification/builders/notifications-builder.abstract.ts` |
| `getUnreadNotificationsCount` | No `@auth` but the resolver reads `context.user.id`, so it throws without a token instead of returning 401 | `backend/gql-schema.graphql` |
| `File.external_link`, `CreateFileUploadLinkInput.external_link` | `@deprecated`; any non-null value errors; the value is always null | `backend/src/modules/file/File.schema.ts` |
| `Program.pace_types`, `PublicProgram.pace_types` | `@deprecated`; always `[]` | `backend/gql-schema.graphql` |
| `GetUserFeedsForProgramsProjectsAndHomePageInput.object_feed_channel_id`, `.is_pinned` | `@deprecated`, explicitly ignored | `backend/src/modules/feed/Feed.schema.ts` |
| `Project.cohort` | `null` both for "no cohort" and "viewer cannot see the cohort" - indistinguishable | `backend/src/modules/project/Project.schema.ts` |
| `HealthCheck.mongoDBHealthy`, `HealthCheck.mongoDBError` | Leftovers from a database that no longer exists; the SDL carries `# FIXME: Remove this when the frontend is no longer using it.` above each. Select neither - while the frontend asks for them the backend cannot drop them | `backend/src/modules/healthcheck/HealthCheck.schema.ts` |

For reference, `check` returns
`HealthCheck { databaseHealthy, databaseError, redisHealthy, redisError,
s3bucketHealthy, s3bucketError, systemHealthy }` (all nullable). Use `systemHealthy`
for an aggregate indicator and the `*Healthy`/`*Error` pairs for diagnosis, ignoring
the mongoDB pair.

Full deprecation list to avoid (grep `@deprecated` to confirm current state):
`Mutation.resetUserPassword`, `UserData.is_user_created_in_identity_provider`,
`ApplySignupCodeResult.institution_id`, `CreateFileUploadLinkInput.external_link`,
`File.external_link`, `Program.pace_types`, `PublicProgram.pace_types`,
`UserProgram.group_id`,
`GetUserFeedsForProgramsProjectsAndHomePageInput.object_feed_channel_id` and
`.is_pinned`, `GitHubPullRequestContributor.github_user` and `.user` (use
`person`), `SkillAchievement.learner` (use `person`).

## 20. Known N+1 and performance traps

`ObjectFeed.files` and `PublicObjectFeed.files` resolve each attachment with a
separate query per file. Do not request `files` in large feed lists - request it
in small pages or on the post detail view. Source:
`backend/src/modules/feed/Feed.resolvers.ts`.

## 21. Coordinating schema changes

- `backend/gql-schema.graphql` and `backend/db-schema.txt` are generated artifacts
  kept in sync by CI (`check-gql-schema`, `check-db-schema` fail on drift). Read
  them; never hand-edit them. Source: `.gitattributes`,
  `.github/workflows/backend-checks.yml`.
- The frontend CI is triggered by changes to `backend/gql-schema.graphql`
  specifically for schema conformance, which makes that file the frontend's
  compliance target. Source: `.github/workflows/frontend-checks.yml`.
- Removing or renaming a field requires `@deprecated` first and confirmation that
  every consumer migrated. If frontend work depends on a backend change, record
  the dependency in the PR description and coordinate merge order. While the donor
  app is still serving production this cuts both ways: a field it still selects
  cannot be removed until the new app has replaced that surface.
  Source: `backend/CONTRIBUTING.md` section 6.
- Webhook endpoints (`/webhook/github`, `/webhook/eventbridge`,
  `/webhook/automation`, `/webhook/kid`, `/webhook/coop`) are server-to-server,
  signature or key authenticated, outside CORS. The frontend never calls them.
  Source: `backend/src/server.ts`, `backend/src/webhooks/`.
