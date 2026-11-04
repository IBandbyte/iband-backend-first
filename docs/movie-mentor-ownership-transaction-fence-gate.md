# Movie Mentor ownership-fence physical RED and repair contract

Evidence: exact backend head ad97baac3f089ad5309412255e8988161ef201a8; physical Mongo ownership-fence workflow 41750639225 failed with accepted result after owner revocation, while seven other courts passed and original operation-idempotency RED remained.

## Why another authorization read is insufficient
The adapter currently validates a server-created mutation authority **before** opening the Mongo transaction. The physical verifier pauses at the state read, revokes ownership, and resumes. Mongo commits anyway. Adding another check immediately before replaceOne narrows but does not eliminate the race: revocation can still happen between check and commit.

## Required durability contract
1. Ownership must be represented by an authoritative durable project/principal/revision record participating in the same Mongo transaction as the creator-state write and operation claim, **or** a rigorously equivalent shared serializable writer/revoker protocol.
2. Transaction must assert project, principal, ownership reference and ownership revision against that record. It must create a write conflict with a concurrent revocation or fail closed; a snapshot-only read of ownership is insufficient if revocation can commit without conflicting with the writer.
3. Revocation itself must use the same durable fence protocol. If the revoker can update ownership through an uncoordinated path, the creator-state transaction cannot guarantee exclusion.
4. Exact server mutation authority remains required; transaction fence is additional, not replacement. Strict production creator-state schema and partial project index must be preserved.
5. If the ownership record and creator state cannot share the transaction's MongoDB deployment, deny writes until a separate proven fencing/lease authority exists.
6. Replay must still revalidate current ownership before returning an accepted result or disclosing prior state.

## Physical acceptance
- Deterministically pause after initial authority verification and revoke ownership; zero creator-state and operation effects, explicit ownership-changed denial.
- Also test revocation racing after transactional ownership read and before commit, with genuine conflicting writes, not just a second check.
- Owner remains valid: normal write and independent-client replay GREEN.
- Original duplicate-write RED remains decisive for transition integration.
- No live route wiring, deploy, merge, main-branch change, or production database mutation.

**Status:** design gate only. The physical RED is preserved. No ownership-fence implementation has been certified.
