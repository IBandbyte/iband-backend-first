# Movie Mentor Phase 01 — Ownership fence decision record (isolated verification)

Status: **NOT CERTIFIED**. Do not merge, deploy, enable publishing, or enable editable restoration.

## Source-level findings at backend 56ae2157

- `MovieMentorProjectOwnershipRegistry.js` declares `ownershipTransfer: false`. Establishment is create-once; `ownerPrincipalId`, `ownershipReference`, and `projectId` are immutable schema fields. `ownershipRevision` is initialized to 1.
- `authorizeProject` reads the Mongo ownership record and matches the authenticated principal. The record inspection requires `status: active`, but the registry does not expose a supported revocation or transfer mutation.
- `MovieMentorCreatorStateMutationAuthority.js` reauthorizes through `requestAuthority.authorize`, outside the creator-state Mongo transaction.
- `MovieMentorCreatorStateMongoOperationAdapter.js` rechecks after the state read but does not enlist the ownership collection in the transaction.

## Exact-head physical evidence

Backend `56ae2157`: replay/contended operations GREEN (41928837294); ownership revoked before post-read recheck GREEN (41928837179); simulated revocation at final write boundary RED (41928837501); durable ownership-fence source contract RED (41928837452).

The postcheck court toggles an in-memory authority response at `states.replaceOne`; it does **not** demonstrate a supported production ownership transfer or revocation endpoint. The source contract RED is structural, not physical Mongo serialization proof.

## Decision and gates

1. Preserve both RED courts and both GREEN regressions.
2. Do **not** add a third external authority check and call it transactional fencing.
3. Decide whether the supported product contract truly guarantees create-once, immutable, always-active ownership; verify *all* write paths, including administrative or direct database paths, before relying on that premise.
4. If revocation, suspension, transfer, or revision changes are to be supported, define their durable mutation path first. Require revocation and creator-state acceptance to serialize against the same ownership document/version in Mongo transactions; test both interleavings with real Mongo sessions and no process-local-only authority simulation.
5. For any transactional design, confirm ownership collection, state collection, and operation ledger use the same client/database/session; require matching owner, project, revision/reference and active status. Avoid claiming that a read-only snapshot of ownership is a lock: revocation must participate in a write-conflict-producing protocol.
6. Re-run original HTTP startup, legacy idempotency, and production composition gates independently; do not borrow GREENs from isolated tests.

**Safety invariant:** unsupported ownership mutations must not be invented solely to turn a test GREEN. If durable coordination cannot be established, fail closed and keep Phase 01 HELD.
