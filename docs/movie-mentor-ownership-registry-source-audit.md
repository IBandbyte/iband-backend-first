# Movie Mentor actual ownership registry integration discovery

Read from exact isolated backend head 894ef81561c7c65b98309b80518a14297a5af949: `ai/MovieMentorProjectOwnershipRegistry.js`, `ai/MovieMentorCreatorRequestAuthority.js`, and `ai/MovieMentorCreatorStateMutationAuthority.js`.

## Verified source reality
- Production ownership collection: `movie_mentor_project_ownership` in MongoDB, with unique projectId and establishmentAuthorityId indexes.
- Registry schema: immutable `projectId`, `ownerPrincipalId`, `ownershipReference`; `ownershipRevision` numeric; `status` enum **only `active`**.
- Registry advertises `ownershipTransfer:false`, and its exported authority offers native establishment, legacy adoption, and authorization, **no transfer or revocation API**.
- `authorizeProject` reads the registry, validates active owner and returns `ownershipRef`/`ownershipRevision`; `MovieMentorCreatorRequestAuthority` binds these to the authenticated principal.
- `MovieMentorCreatorStateMutationAuthority` refreshes request authorization and compares initial and current ownership reference/revision. This is a useful fresh check but is outside the creator-state Mongo transaction.
- The existing physical ownership-fence RED uses an injected in-memory `active` boolean; it proves the isolated adapter accepts a stale capability if ownership can change, **not** that the current production registry exposes a revocation operation.

## Integration implication
Do not invent or enable a production revocation/transfer endpoint to satisfy a hypothetical race. First establish the policy: is ownership intentionally immutable for Phase 01, with revocation only through administrative/security controls, or is revocation a required capability? Any new revocation path must be included in a shared transactional fence; simply reading the registry inside a snapshot transaction does not prevent later revocation.

## Recommended next physical court
Use an isolated replica set with a production-shaped ownership registry document and creator-state/operation collections. Implement a dedicated transactional ownership-fence dependency that checks projectId, ownerPrincipalId, ownershipReference, ownershipRevision, status and **writes a conflicting fence token in the ownership record in the same transaction**. A simulated revoker must update that same record, producing a write conflict or retry rejection. Require exact indexes and no production schema changes. The existing mutation authority remains mandatory.

Do not connect the live transition or claim the original duplicate-write RED repaired. Publishing, restoration, deploy, merge and production writes remain disabled.
