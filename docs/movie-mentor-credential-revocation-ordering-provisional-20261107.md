# Movie Mentor Phase 01 — credential revocation and transaction ordering

**Status: PROVISIONAL POLICY PROPOSAL — NOT APPROVED OR CERTIFIED.**
**Baseline:** `7cf50c4bee93438a84c5019ab27ce02f56fc152f`.
**Scope:** Creator-state mutation authorization and the MongoDB ownership-fenced transaction. No change to production behaviour is authorized.

## Proposed contract

1. A credential that the authoritative verifier reports revoked or inactive **before the final fresh mutation-authorization check** must be rejected. No creator-state or operation record may commit from that attempt.
2. An operation that has passed that check and successfully acquired the durable ownership fence may complete, provided the ownership record, revision/CAS, transaction and idempotency requirements remain satisfied. Credential revocation observed later does **not automatically** retroactively invalidate an already-authorized operation.
3. A durable ownership revision/status change ordered before the transactional ownership fence must deny stale acceptance. A competing ownership change ordered after the fence must respect Mongo transaction serialization; it cannot retroactively rewrite the preceding transaction's order.
4. **Emergency suspension / immediate cancellation is not guaranteed by this contract.** If required, define an authoritative durable revocation/suspension record and its transactional ordering with acceptance; do not implement a post-write process-local boolean check as a substitute.
5. Replay and idempotency semantics are separate: the adapter checks for an existing operation record within the transaction before its second fresh mutation-authority check. The authorization policy for replay responses must be assessed separately; no inference that replay is equivalent to a new write.

## Observed implementation, not provider certification

- `ai/MovieMentorDeterministicPrincipalAdapter.js` rejects verifier evidence with `revoked:true` or `active:false`, and rejects expired evidence. It accepts injected `verifyCredential` evidence; this code does **not** prove that a deployed identity provider performs online revocation checks on every call.
- `ai/MovieMentorCreatorStateMutationAuthority.js` calls `requestAuthority.authorize` on each `assertCurrentMutation`.
- `ai/MovieMentorCreatorStateMongoOperationAdapter.js` checks mutation authority before opening the transaction, checks again after transactional state read, then conditionally increments `creatorStateFenceEpoch` on canonical ownership within the transaction before state/operation writes.
- Isolated exact-head CI at `7cf50c4b`, [run 42363701163, job 128377179517](https://github.com/IBandbyte/iband-backend-first/actions/runs/42363701163/job/128377179517), reported `GREEN: revoked credential is denied at the fresh pre-mutation authorization boundary`. The verifier itself states it does not test Mongo transactions, post-fence revocation, HTTP journeys or live Clerk revocation.
- Authentication-provider-specific semantics, token/session caching, revocation propagation latency, production wiring and emergency suspension behaviour remain **UNVERIFIED**. Do not claim compatibility with live Clerk or any other provider without provider documentation and integration evidence.

## One targeted physical examination — design only, NOT executed

Use an isolated disposable Mongo replica set, real `createMongoCreatorStateAtomicAccept`, the canonical ownership collection and genuine unique indexes. Inject a controlled credential verifier with two independent barriers and collect durable state, operation and ownership records after each scenario.

**Scenario A — revoke before final authority check:** Admit with active credential, block the transactional `states.findOne` return, switch injected verifier to revoked, release the read. Expect explicit `MOVIE_MENTOR_AUTH_REVOKED` denial and zero new creator-state/operation writes. Confirm the ownership fence did not advance.

**Scenario B — revoke after durable ownership fence:** Admit with active credential, let the final authority check pass and the conditional ownership `updateOne` resolve inside the transaction, then pause before `states.replaceOne`. Switch injected verifier to revoked, release the write. Under the *proposed* contract, the already-authorized operation may commit once if all other transaction requirements hold. A new operation using that revoked credential must fail. Observe the actual commit ordering; do not label this GREEN until a dedicated exact-head CI job proves it.

**Scenario C — durable ownership revision before fence:** Independently update the canonical ownership revision/status before the conditional fence; expect rejection or transaction rollback with zero creator-state/operation effects. Reuse the prior physical regression where possible rather than duplicating courts.

**Limits:** An injected verifier proves application logic, not the identity provider's real revocation propagation. Scenario B tests the chosen linearization semantics, not immediate emergency shutdown. Real HTTP startup/composition, provider integration, and frontend acceptance remain separate gates.

## Disposition gates

- Obtain owner/security approval of this proposed contract, including replay and emergency suspension expectations.
- Verify real authentication-provider semantics and deployed verification configuration.
- Register the dedicated physical court **verifier first**, preserve original postcheck RED unchanged, then require exact-head job logs.
- Preserve `scripts/verify-movie-mentor-creator-state-mongo-postcheck-revocation.mjs` and its RED unchanged pending explicit supersession disposition.
- **Phase 01 HELD; no merge, deploy, production DB write, publishing, editable restoration or main-branch modification.**
