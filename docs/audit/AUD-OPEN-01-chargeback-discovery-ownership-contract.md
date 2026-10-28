# AUD-OPEN-01: completed chargeback recovery contracts (proposed)

Status: **audit contract, not a production implementation or release certification**.
Scope: Movie Mentor completed Stripe chargeback reversal discovery and preserved-value settlement.
Evidence anchor: PR #433 exact head `d295bd63e1eff1a77117af915ba026b784d246b5`; dedicated physical run `40118173807`.
Safety: verifier first; no borrowed verdicts; main untouched; no production database writes, deployment or merge.

## Physical evidence that the contract must explain

- Real root startup with a signed-ingress completed chargeback and isolated MongoDB `findAndModify` failure returned `/health` HTTP 200 while Stripe commercial ingress remained closed; its dedicated court passed.
- Production-ID court: an earlier-generated reversal ID committed after the scanner advanced and was missed by `reversalId > cursor`.
- Transactional concurrent-cursor court: an earlier key committed after later keys were paged and was missed.
- Production lease-boundary court: expired and forged `leaseProof` objects were not rejected; a real preserved-value financial settlement was observed.

These are distinct physical observations. A passed court at one SHA cannot certify a later SHA.

## D1: durable discovery safety and liveness

**Safety:** Every verified, durably committed reversal receipt retains its immutable provider/evidence identity and is never treated as settled merely because a scan cursor has passed it. A scan that sees no more rows is only an observation of that scan; it is not a commit-order watermark.

**Liveness:** For every durably committed, valid chargeback receipt with matching completed purchase lineage and an existing preserved-value ledger, a running healthy recovery service must eventually either (a) durably settle it exactly once or (b) expose an actionable, durable unresolved/error state for retry. Restarts and competing workers cannot permanently strand a receipt.

**Minimum proof:**
1. An earlier-generated ID commits after a later ID has already been paged: it is rediscovered without manual cursor reset.
2. A transaction with an earlier ID commits after the last page: it is rediscovered.
3. A process dies between discovery and settlement; another instance resumes without losing or duplicating the financial effect.
4. Multiple workers and replayed Stripe events cannot double-apply the same chargeback evidence.
5. Bounded pages, empty pages, partial failures, and legacy receipts retain forward progress without falsely reporting comprehensive completion.
6. Startup readiness and ingress failure closure continue to work when settlement fails.

**Acceptable design directions for evaluation, not yet approved:** repeated full-keyspace bounded sweeps with no persisted exclusionary cursor, or a durable unresolved-work/outbox index created transactionally with the receipt. A simple ObjectId, wall-clock, `createdAt`, or high-water cursor is *not* a safe commit-order watermark. A background 750 ms rescan is not itself proof of eventual durable progress, especially across restarts and repeated failures.

## O1: durable recovery ownership and financial fence

**Safety:** No worker lacking current, database-verified recovery authority may commit a financial settlement. Expired, forged, superseded, cross-domain, and cross-generation proofs must fail closed. A lease check at scan entry alone is insufficient: a lease may expire or be superseded before the financial mutation.

**Minimum durable ownership state:** recovery domain, owner identity, strictly monotonic generation/fencing token, database-controlled lease expiry, and auditable acquisition/renewal/transfer history. Lease issuance and generation advancement must be atomic and must not rely on caller-provided timestamps or an unsigned caller-supplied `leaseProof`.

**Mutation fence:** The actual financial writer must enforce the current durable generation/owner in the same atomic transaction or equivalent database-enforced conditional mutation as the settlement. The settlement's existing unique evidence identity and compare-and-swap protections remain mandatory. Merely checking a lease and then calling an unfenced `terminallySettlePreservedValue` is vulnerable to a time-of-check/time-of-use race.

**Minimum proof:**
1. Expired proof rejected before any financial mutation.
2. Forged proof rejected before any financial mutation.
3. Old owner loses authority after generation transfer, even if already scanning.
4. Lease expires between observation and write: writer rejects without settlement.
5. New legitimate owner can recover the outstanding receipt once; replay is idempotent.
6. Lease acquisition/renewal/transfer survives restart and concurrent competing workers.
7. An outage of durable lease storage fails closed; it does not silently switch to process-local authority.
8. Existing signed-ingress, root readiness, index/lineage, and refund-versus-chargeback fences remain intact.

## Integration and release gates

- **Verifier first:** preserve the current three REDs; add separate isolated-Mongo courts for D1 and O1 before implementation.
- **No borrowed GREEN:** every code change creates a new exact head requiring full dedicated workflow retest.
- **No false completion:** distinguish a completed finite sweep from a guarantee that all concurrent future commits have been handled.
- **No unsafe shortcuts:** no process-local-only lease, synthetic caller certification, assumed ObjectId commit ordering, unconditional settlement update, or production database experiment.
- **Authority:** this document proposes requirements only. Choosing schema, transactional coupling, migration, and release behavior remains a separately reviewed engineering decision.
