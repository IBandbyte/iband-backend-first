# Movie Mentor creator-state ownership linearization — provisional contract (isolated verification)

Status: **NOT CERTIFIED**. This document describes tested behaviour, not approval to merge, deploy, publish, or restore editable projects.

## Durable ordering

1. Admission checks authenticated project ownership.
2. The transaction rechecks authority after reading state.
3. The transaction conditionally writes the canonical `movie_mentor_project_ownership` record, matching project, principal, ownership reference, revision, and active status. The increment of `creatorStateFenceEpoch` is the durable write-conflict participant.
4. Creator state and operation ledger are written in that same transaction.

If a durable revocation commits **before** the fence write, the old owner's acceptance must be denied without durable creator-state or ledger effects. The original durable ownership race examination now tests this order.

If acceptance acquires the fence first, a competing durable revocation must not commit until acceptance has completed its transaction. The canonical overlap physical examination tests this order. An acceptance completed before a revocation is not a revoked-owner acceptance.

## Unresolved process-local revocation

The original postcheck test changes only a process-local `active` flag inside `states.replaceOne`, **after** the transactional ownership fence. It does not mutate the canonical durable ownership record. At exact head `a89d19dc`, that test physically receives `accepted` and fails its original rejection assertion. The separate late-local characterization passes and confirms this behaviour. Neither result proves that arbitrary non-durable authorization revocations are safe.

**Decision required before reconciliation:** determine whether production authorization can be revoked independently of the canonical ownership record, and if so identify its authoritative durable storage and a serialization mechanism shared with creator-state acceptance. A post-write recheck alone cannot provide atomic serialization.

## Required certification gates

- Keep the original postcheck RED visible until its authority semantics are explicitly resolved; do not remove or invert its assertions merely to turn CI GREEN.
- Verify all actual production ownership transfer/revocation paths participate in the same durable fence protocol; tests using direct Mongo mutations do not establish this by themselves.
- Independently verify full HTTP startup/composition and frontend integration.
- Preserve Phase 01 HOLD, no production database write, no merge, and no deploy.
