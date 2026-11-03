# Movie Mentor creator-state operation idempotency — storage design gate

Status: DESIGN ONLY. No backend publishing enabled, no production schema migration, no production writes.

## Physical evidence

- Exact-head `24035a5a` operation-idempotency court reached its assertion and failed: a repeated `operationId` with a newly current `expectedRevision` was accepted by the isolated transition.
- Existing owner and revision courts passed; those checks do not deduplicate logical operations.
- `MovieMentorCreatorStateStore` uses one unique `projectId` record and revision CAS. Its strict schema does not persist `operationId` or a deduplication ledger. The transition currently ignores the client `operationId`.
- The current RED-first court supplies a simulated valid owner and an in-memory CAS store. It is not a live HTTP, MongoDB, or unauthenticated-attacker demonstration.

## Required atomic protocol

1. The authenticated request supplies a stable, nonempty `operationId`, a project ID, an expected revision and a canonical request payload. The backend independently derives the authenticated principal and checks current ownership.
2. Compute a server-side digest of the canonical operation envelope (project, authenticated principal, operation ID, source, expected revision and permitted payload). Do not trust a client-provided digest.
3. At the irreversible store boundary, atomically decide among: **first acceptance**, **same-operation replay**, **conflicting operation-ID reuse**, and **revision conflict**. The decision and state mutation must share a durable atomic boundary; a separate preflight read is insufficient.
4. For a first acceptance, persist the operation key, request digest and committed revision/result reference together with the creator-state revision increment. A retry after lost acknowledgement must recover the recorded result without another state mutation.
5. Reuse of an operation key with a different canonical request must be rejected. A duplicate with the same envelope must not require a new current revision, and must never be treated as a fresh mutation.
6. Project ownership must be revalidated on every request, including replay. An operation key from another creator or project must not authorize a result or a write.
7. The ledger must survive process restart and concurrent workers. Bound retention and pruning cannot silently re-authorize old operation keys; define the retention contract before enabling publication.
8. If MongoDB uses a separate operations collection, use a transaction with the creator-state CAS write and a unique operation-key index; if embedding bounded records in the project document, use one atomic conditional update and a documented lifetime policy. Do not claim a read-then-write mutex is durable idempotency.

## Independent physical courts required before implementation certification

- Same operation ID + same payload after lost acknowledgement: same accepted result, exactly one durable state effect.
- Same ID + different payload: conflict, zero new effects.
- Same ID + advanced expected revision: no new effect.
- Two concurrent requests with same ID, and with distinct IDs at the same revision: exactly one state revision transition per accepted operation.
- Crash before commit, crash after commit but before response, process restart, and cross-worker retry.
- Revoked ownership, cross-project reuse and cross-principal reuse: no unauthorized result disclosure or mutation.
- Storage-level unique index / transaction or atomic embedded-ledger behaviour, not merely a mocked transition.
- Existing revision, ownership, authority injection, and no-production-write courts remain GREEN.

## Containment

Until storage-level replay protection and the above physical courts are certified, preserve the genuine operation-idempotency RED. Frontend local outbox intent is not server authorization. Keep publishing disabled, Phase 01 held, both main branches untouched, no production DB writes, deploys or merges.
