# AUD-OPEN-01 — trusted chargeback recovery ownership contract (audit branch only)

Status: design contract, NOT implemented, NOT certified. Baseline PR #433 exact head d699e00d8020a17c6580c5efa8baf4a2e60588b0; dedicated run 40548522549 RED. This file does not authorize merge, deploy, production writes, or relaxing existing physical courts.

## Security boundary
- The recovery scanner currently accepts four original owner-proven authorities and rejects caller-supplied `leaseProof`. Those authorities prove reversal/checkout/purchase/disposition provenance; none proves an exclusive durable recovery worker.
- `terminallySettlePreservedValue` independently reads committed provider reversal evidence and mutates the preserved-value ledger. Its financial CAS is not a recovery-owner generation fence.
- The existing verifier's `aud_open_01_real_writer_transfer_fence` lease is a verifier-only fixture, not a production authority. The transactional candidate is also isolated. A Mongoose `session` alone is not owner proof.

## Proposed minimal internal authority
1. Compose a private, durable recovery ownership authority in the production composition root. The public recovery API must continue rejecting caller-supplied `origin` and `leaseProof`; never trust a user-supplied owner/generation, even if well shaped.
2. Persist a single recovery lease record keyed by an unambiguous recovery domain/scope, with owner identifier, monotonically increasing generation, lease expiration, and a revision/fence field. Acquire/renew/takeover must use MongoDB server-time predicates and atomic compare-and-swap. Do not reuse the unrelated journey activation lease.
3. Keep the worker's acquired generation in an internal closure/capability, not in caller-controlled settlement coordinates. Scope the capability to the real completed-chargeback recovery path. Direct provider reversal settlement and refund must preserve their own existing authority rules.
4. At each chargeback ledger mutation, start a MongoDB transaction on the same connection/database as the authoritative lease document. Inside that transaction, WRITE the lease document with an exact owner+generation+server-time validity predicate and increment its fence revision; require exactly one match. Then read the matching committed reversal evidence and perform the financial CAS/update using the SAME session. Commit atomically. A read-only lease check is insufficient.
5. A takeover must update that same lease document. It must conflict with a concurrent in-flight fenced settlement or occur before the stale transaction's lease write. The losing worker must fail closed with the recovery-fenced error; no stale ledger effect.
6. CAS retries and transient transaction retries must retain the SAME internal owner/generation and revalidate the lease by a write on every new transaction attempt. Never recursively restart as an unfenced public settlement. For unknown commit outcomes, reconcile durable chargeback event identity and financial totals before deciding whether to retry; never double-apply.
7. Preserve exact payment/principal/intent/currency/amount lineage, committed Stripe reversal evidence, cumulative refunds, partial chargebacks, event idempotency, and legitimate successor exactly-once settlement. Reversal ID cursors remain traversal positions, not durable high-water marks.

## Physical acceptance matrix (no borrowed verdicts)
A. Forged caller origin/leaseProof cannot mint authority.
B. Expired, superseded, or wrong-generation worker is rejected at real financial mutation; zero stale financial effect.
C. Ownership takeover concurrent with a real in-flight transaction cannot commit a conflicting stale effect.
D. New durable owner can settle the original provider-proven reversal once; replay is idempotent.
E. CAS contention and transaction retry do not shed the original owner fence.
F. Post-commit acknowledgment uncertainty does not duplicate or lose provider-proven value; independently distinguish server writeConcernError from network loss.
G. Both production-generated reversal-ID commit-order and original isolated cursor-order REDs remain independently executable and must pass after any separate cursor repair.

## Verifier hardening required before claiming integration GREEN
- Current `real-authority-transaction-integration` checks `args[0]?.session` at `findOneAndUpdate`. A session may also be attached via Mongoose query chaining. Inspect the executed query/session and prove the SAME transaction contains a matched durable lease-document WRITE; `session.inTransaction()` by itself is insufficient.
- Existing stale-writer test transfers a verifier-only lease and does not test a production-acquired owner. A future real-authority court must exercise internal acquisition, takeover, and successor recovery against an isolated replica set.
- Preserve all existing RED courts unchanged as independent regression evidence. Each new commit invalidates prior-head CI verdicts; use fresh exact-head runs.

Implementation is deliberately deferred until the trusted internal authority and physical verifier agree on the same ownership document and transaction boundary.
