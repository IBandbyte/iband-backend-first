import assert from "node:assert/strict";
import {createMovieMentorEntitlementIssuanceAuthority} from "../ai/MovieMentorEntitlementIssuanceAuthority.js";
console.log("Movie Mentor entitlement issuance receipt evidence-kind binding authority court");
const capability=Object.freeze({domain:"iband.movie-mentor.entitlement-issuance-store",configured:true,atomicity:"mongo-transaction",entitlementCollection:"movie_mentor_inference_entitlement",issuanceCollection:"movie_mentor_entitlement_issuance",evidenceIdentityUnique:true,entitlementMutationAtomic:true,issuanceReceiptDurable:true,currentEntitlementRead:true,processLocalFallback:false});
const evidence={verified:true,evidenceId:"evt-kind-A",evidenceSource:"stripe",evidenceKind:"payment-completed",principalId:"creator-A",units:20,commercialReference:"intent-A",evidenceDigest:"digest-A",verifiedAt:"2036-01-01T00:00:00.000Z"};
const store={getStatus:()=>capability,async resolveCurrentEntitlement(){return null},async issue(n){return {issued:true,idempotent:false,receipt:{issuanceId:"issue-A",...n,evidenceKind:"refund-completed",entitlementRevisionBefore:0,entitlementRevisionAfter:1,status:"issued",issuedAt:"2036-01-01T00:00:01.000Z"}}}};
const authority=createMovieMentorEntitlementIssuanceAuthority({store,allowedEvidenceSources:["stripe"],allowedEvidenceKinds:["payment-completed"]});
await assert.rejects(()=>authority.issueVerifiedEvidence({evidence}),e=>e?.code==="MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_RECEIPT_INVALID","issuance authority must reject a durable receipt whose evidence kind differs from the verified evidence universe");
console.log("GREEN: issuance receipt must bind exact verified evidence kind.");
