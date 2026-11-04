# Movie Mentor production HTTP atomic ingress — source audit

Status: isolated audit. No live route change, deployment, merge or production database operation.

At backend exact head 2eb6ec58e478c90afcafdca1ac8d23118dd84071 the disposable Mongo creator-decision physical court passed; the original legacy operation-idempotency and hypothetical ownership-revocation courts remain RED.

## Actual mounted ingress
- server.js mounts createMovieMentorTurnRouter({requestAuthority,inferenceSpendAuthority,inferenceExecutionAuthority,inferenceSettlementAuthority}) under /api/movie-mentor after independent authentication, ownership, spend, execution and settlement owner-proof gates.
- movieMentorTurn.js POST /state/sync calls applyStateTransition(authorized.body,{creatorStateMutationAuthority}). It does NOT pass a server-bound principalId or atomicAcceptCreatorStateOperation. This is a distinct direct legacy write route.
- movieMentorTurn.js POST /turn constructs serverAuthority from the authenticated authorization, creates mutation/consumption/forward capabilities, and supplies commitCreatorDecision closure with creatorStateMutationAuthority only. It does NOT pass atomicAcceptCreatorStateOperation or principalId to commitCreatorDecision.
- ai/MovieMentorCreatorStateConsumptionRuntime.js binds creatorTurnId to commitCreatorDecision. ai/MovieMentorTurnRuntime.js and ai/MovieMentorTurnOrchestrator.js pass the decision dependency to ai/MovieMentorCreatorDecisionAuthority.js.
- The isolated creator-decision opt-in at 792a7ff7 accepts deps.atomicAcceptCreatorStateOperation and deps.principalId, but the production /turn closure never supplies them. Therefore physical Mongo GREEN does not certify either mounted HTTP route.

## Required ingress gates before enabling
1. Prove a server-derived authenticated principal and exact ownership capability, never accept client-provided principal or operation authority.
2. For /state/sync, require stable operationId, expectedRevision and atomic adapter; deny any legacy fallback when the new ingress contract is enabled. For /turn, bind creatorTurnId as operationId through commitCreatorDecision.
3. Provision a durable operation ledger collection with the exact compound unique index and verify existing production state project's partial unique index; do not create indexes implicitly during live request handling.
4. Ensure native Mongo transaction client and both collections use the same database and session, with explicit readiness/ownership proof and fail-closed behavior.
5. Run RED-first HTTP-level courts on both endpoints, then disposable Mongo HTTP physical courts including duplicate requests, payload collisions, lost acknowledgement, stale revisions, restart replay and current-ownership failure.
6. Preserve creator decision readback, canonical response and inference spend/execution/settlement fences; do not weaken their gates to achieve an isolated GREEN.

The current production /state/sync and /turn routes are **not** atomic-ledger integrated. This is a source-level audit, not a claim that the production endpoint is currently reachable: server.js mount is conditional on readiness gates.
