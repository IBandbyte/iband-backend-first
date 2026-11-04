# Movie Mentor creator-state transactional integration gate

Status: isolated design and migration checklist only. No production route wiring, deployment, merge or database mutation authorized.

## Verified foundation
At backend exact head a234e4d, seven of eight isolated workflows passed. The original operation-idempotency verifier remained RED. The Mongo adapter now validates current mutation authority, both physical unique indexes, concurrent operation replay and lost acknowledgement.

## Critical incompatibilities before wiring
1. The production creator-state store uses a Mongoose strict schema in collection `movie_mentor_creator_state`, with a **partial unique** projectId index (`{projectId:{$type:"string"}}`). The isolated adapter currently demands an unqualified unique projectId index. The existing production index must not be replaced or weakened merely to satisfy the test. Verify the exact partial predicate and require projectId to be a nonempty string before writing.
2. The adapter currently persists raw `proposedState` through the Mongo driver, while the production store serializes and validates its authoritative fields through `writeDocument` and `normalizeDocument`. A migration must preserve exact fields, date types, strict schema semantics, normalization, and the atomic operation claim.
3. `applyMovieMentorCreatorStateTransition` performs a preflight read and generates random transition references before its non-atomic write. A replay can be rejected as a revision conflict before the operation ledger is consulted. The operation claim must be resolved atomically before revision conflict on a retry, and next-state construction must use the state read under the transaction.
4. The original RED verifier retries the same `operationId` with an **advanced expectedRevision**. The canonical operation digest intentionally binds expectedRevision, so this is **not an identical replay**. The integration contract must reject it as operation-ID conflict or replay misuse without a second write. The existing verifier expects `MOVIE_MENTOR_CREATOR_STATE_OPERATION_REPLAY`; do not silently redefine this contract or alter the verifier without an explicit compatibility decision.
5. The operation ledger checks ownership before calling `atomicAccept`, but the adapter's current authority assertion occurs before transaction entry. Owner revocation between that assertion and commit is still a time-of-check/time-of-use concern. A durable ownership fence or transactionally verifiable ownership revision is needed before treating this as fully authorized.
6. The existing store's partial unique index and its `physicalReady` cache belong to a separate read/write path. The integrated adapter must not bypass the store's authoritative readiness or accidentally use the isolated test collections.

## Required physical gates
- Real isolated Mongo replica set with production-equivalent strict schema and exact partial project index.
- Same operation ID with advanced expected revision: zero additional state writes; explicit stable error.
- Identical retry after lost acknowledgement: same committed result, zero additional state writes.
- Concurrent identical and distinct operation submissions.
- Owner revoked between request admission and transaction commit: no write.
- Schema round-trip through the existing normalized creator-state reader.
- Exact-head CI of original transition and HTTP courts; no borrowed verdicts.

## Rollout boundary
Keep `/state/sync` and live publishing disabled until these gates pass. No merge, deploy, main-branch mutation or production DB write.
