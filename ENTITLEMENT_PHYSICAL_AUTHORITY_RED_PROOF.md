# Entitlement issuance physical authority — RED proof

Baseline: `5c21484316d2e50de4d313ff76395cadd1f3230b` (main after #183).

Production store declared three unique identities but `ready()` accepted successful `createIndexes()` without observing the actual Mongo collection catalogue. The verifier fixture supplies successful `createIndexes()` and a physical catalogue containing only `_id_`. Untouched baseline therefore enters transaction authority instead of failing with `MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_PHYSICAL_AUTHORITY_UNAVAILABLE` before mutation.

This is a genuine adjacent physical-authority gap, not borrowed from #157's initialization-readiness court.

Required physical identities:
- entitlement `{principalId:1}` unique
- issuance `{issuanceId:1}` unique
- issuance `{evidenceSource:1,evidenceId:1}` unique

Repair on this branch requires observed collection indexes before transaction authority.