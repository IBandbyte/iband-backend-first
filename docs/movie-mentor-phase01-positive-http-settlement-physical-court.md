# Movie Mentor Phase 01 — Positive HTTP Settlement Physical Court

Status: **NOT CERTIFIED**. This document is a verifier-first contract, not an implementation or a CI verdict.

## Authority boundary

Run only in the isolated MongoDB replica set with disposable Clerk RS256 test keys and a local mock provider. No production database, deployment, merge, or main-branch changes. The full examination must be registered in the isolated preflight workflow and must pass on the exact commit head before any GREEN claim.

## Required single-journey evidence

1. Establish durable native project ownership and one spend entitlement for the test principal. Assert that a different principal cannot create or replay the turn.
2. Submit a signed-JWT HTTP POST to the actual Movie Mentor Express router for a previously unseen creatorTurnId. No execution, reservation, candidate, canonical result or provider effect for that turn may be preseeded.
3. Let the production forward execution runtime create and reserve the execution through its normal HTTP path. Capture the durable execution ID, request digest, reservation ID, and creator-state proof.
4. Execute the real orchestrator and fenced provider-call admission. Use an isolated deterministic provider response that is valid for the semantic interpreter and any subsequent required stages. Assert every provider call is admitted under its historical slot and task, and each call count is bounded by the execution's budget.
5. Require durable result-candidate staging with genuine creator-state consumption proof; closing, closure reconciliation, canonical result commit and settlement must occur through the runtime's production-composed authorities. Do not directly create a finalized execution or inject a canonical result as a shortcut.
6. Assert HTTP success only after canonical exposure authorization, finalization and settled spend. Require exactly one canonical result, one consumed reservation and exactly one consumed unit; reserved units must be zero.
7. Terminate the first process. Start a new process with fresh Mongo connections and a new Express server. POST the exact same authenticated creator turn and assert the canonical response is replayed without any new provider socket, reservation, debit, candidate, canonical result or execution.
8. POST the same creatorTurnId with a changed message and assert a deterministic identity/digest denial. POST as a different owner and assert denial without any ledger mutation.
9. Compare physical Mongo documents and mock-provider socket counters before and after replay. Reject all synthetic guard exceptions, borrowed verdicts, mutable-state bypasses and unexpected financial revision/balance changes.

## Existing evidence — not interchangeable with this court

- `scripts/verify-movie-mentor-isolated-clerk-http-owner-spend.mjs` proves real signed-JWT HTTP admission, socket-loss UNKNOWN effect and authentic recovery denial, but not successful finalization.
- `scripts/verify-movie-mentor-isolated-settlement-missing-execution.mjs` proves durable candidate/closure/canonical/settlement on a directly seeded execution; its own logs disclose synthetic ownership and creator-state fixtures.
- `scripts/verify-movie-mentor-isolated-settled-http-worker.mjs` proves fresh-process authenticated replay of an already settled execution; it does not prove the initial HTTP creation.

## Failure discipline

A test that never reaches the real orchestrator, that directly seeds an execution for the positive path, that fabricates a provider result after the fact, or that merely calls HTTP replay against a separately seeded settlement **must remain RED / NOT CERTIFIED**. Keep Phase 01 held until the entire positive journey passes at the same exact head.
