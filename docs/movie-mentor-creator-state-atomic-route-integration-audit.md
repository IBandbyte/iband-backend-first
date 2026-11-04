# Movie Mentor creator-state atomic route integration gate

Status: isolated design/audit only. No production route, main branch, deployment, or production database mutation authorized.

## Verified baseline
At exact head 0f31747a7660ce85002b049d18b5345f378a2e13, the disposable Mongo end-to-end transition examination passed. The legacy operation-idempotency and hypothetical ownership-revocation fence examinations remain RED.

## Production incompatibilities requiring resolution before wiring
1. The active transition's default branch still calls readAuthoritativeTurnSource followed by writeAuthoritativeCreatorState. The store uses separate create/findOneAndUpdate operations, not the operation ledger; a repeated operation ID can advance the revision twice.
2. The isolated atomic branch is activated only through injected deps.atomicAcceptCreatorStateOperation and deps.principalId. Production callers do not yet supply these. Merely passing operationId through the existing route does not provide idempotency.
3. Mongo operation adapter requires a durable unique compound (projectId,principalId,operationId) index in a separate operation collection. Production collection ownership, schema/index provisioning, connection/session reuse, and readiness checks must be explicit and fail closed. No implicit index creation on a live database.
4. The isolated atomic transition reads state before opening the transaction, and for stale expected revisions fabricates a read-only candidate revision/generation. The ledger checks replay before CAS, but candidate authority must not be mistaken for current committed lineage. For a new stale operation the transaction must return revision-conflict without write.
5. The operation ledger canonicalOperation and transition digest must remain byte-for-byte compatible; server-bound principal and current ownership capability must match. Client-provided authority fields remain forbidden.
6. A production route migration needs physical tests of duplicate submission, lost acknowledgement after independent connection, payload collision, revision-one replay after revision two, stale new operation, and failure when the ledger index or current ownership proof is absent.
7. Ownership registry currently exposes establishment/adoption/authorization, not a production transfer/revocation API. The separate ownership-fence RED is an isolated future-revocation safety gate, not evidence of a live transfer endpoint.

## Next bounded engineering step
Create a RED-first isolated *route-to-store* test that invokes the same request/transition entry point used by the active route with a disposable MongoDB replica set and verifies that it cannot reach the legacy writer. Resolve the storage/operation collection provisioning contract without touching production. Only after exact-head physical GREEN should the real route wiring be considered, and only on an isolated branch.

## Confirmed live creator-decision caller chain (source inspection)
- ai/MovieMentorCreatorStateConsumptionRuntime.js wraps runMovieMentorTurn, binds creatorTurnId, and supplies commitCreatorDecision.
- ai/MovieMentorTurnRuntime.js constructs orchestrationDeps including commitCreatorDecision, readAuthoritativeTurnSource, applyMovieMentorCreatorStateTransition, and writeAuthoritativeCreatorState, but does not forward creatorStateMutationAuthority in that object.
- ai/MovieMentorTurnOrchestrator.js calls commitCreatorDecision with read, transition, writer, and creatorStateMutationAuthority dependencies.
- ai/MovieMentorCreatorDecisionAuthority.js commitCreatorDecision invokes transition with source creator-decision, expectedRevision and merged creatorConfirmedContext, but NO operationId. Its transition deps pass read, legacy writer, and mutation authority, but NOT principalId or atomicAcceptCreatorStateOperation.
- Therefore the currently inspected creator-decision path cannot enter the experimental atomic transition branch. The creatorTurnId is stable but is not currently bound into an atomic operationId on this path. Do not substitute a random operationId, which would defeat retries.
- The decision module performs its own preflight read, prior-turn detection, post-write readback, and raced-retry reconciliation. Migrating to atomic acceptance must preserve creator-decision fingerprint/turn conflict semantics and post-commit authority, not simply replace a call site.
- These are source-level findings, not a new physical RED. A route-level verifier must first capture the current legacy behavior, then require stable turn-derived operation identity, explicit server principal/authority, and atomic storage injection without bypass.
