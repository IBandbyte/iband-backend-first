import assert from "node:assert/strict";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";

console.log("Movie Mentor partial-chargeback surviving-value authority court");

const original=1200,refunded=500,chargeback=300,surviving=400;
let row={provider:"stripe",providerPaymentReference:"pi-414",commercialIntentId:"intent-414",principalId:"creator-414",amountMinor:original,currency:"GBP",units:20,reason:"entitlement-suspended",refundAuthorized:false,cumulativeRefundedAmountMinor:refunded,remainingAmountMinor:original-refunded,lastRefundReference:"re_414",chargebackAmountMinor:0,status:"preserved-credit",terminalDisposition:null,terminalReference:null,preservedAt:new Date()};
const leanExec=v=>({lean:()=>({exec:async()=>v})});
// Unit-fixture evidence is independent of the accounting row. This is not a
// physical provider-ingress verdict: the isolated MongoDB courts prove that.
const receipt={domain:"iband.movie-mentor.inference-spend",schema:1,evidenceSource:"stripe",evidenceId:"dp_414",evidenceKind:"charge.dispute.funds_withdrawn",providerPaymentReference:"pi-414",commercialReference:"intent-414",principalId:"creator-414",status:"suspended",reversalAmountMinor:chargeback,currency:"GBP"};
let evidenceAvailable=false;
const evidenceDb={collection:(name)=>{assert.equal(name,"movie_mentor_commercial_reversal");return {findOne:async q=>evidenceAvailable&&Object.entries(q).every(([k,v])=>receipt[k]===v)?receipt:null};}};
const model={
 db:evidenceDb,
 createIndexes:async()=>{},collection:{indexes:async()=>[{unique:true,key:{provider:1,providerPaymentReference:1}},{unique:true,key:{terminalDisposition:1,terminalReference:1},partialFilterExpression:{terminalDisposition:{$type:"string"},terminalReference:{$type:"string"}}}]},
 findOne:()=>leanExec(row),
 findOneAndUpdate:(q,u)=>leanExec((()=>{if(row.status!==q.status)return null;if(q.remainingAmountMinor!==undefined&&row.remainingAmountMinor!==q.remainingAmountMinor)return null;if(q.chargebackAmountMinor!==undefined&&row.chargebackAmountMinor!==q.chargebackAmountMinor)return null;if(q.chargebackEvents?.$not?.$elemMatch?.reference&&row.chargebackEvents?.some(e=>e.reference===q.chargebackEvents.$not.$elemMatch.reference))return null;row={...row,...u.$set,...(u.$push?.chargebackEvents?{chargebackEvents:[...(row.chargebackEvents||[]),u.$push.chargebackEvents]}:{})};return row;})())
};
const composition=createMovieMentorProductionCommercialValueDispositionComposition({injectedModel:model});
assert.equal(composition.ready,true);
const coordinates={provider:"stripe",providerPaymentReference:"pi-414",commercialIntentId:"intent-414",principalId:"creator-414",amountMinor:original,currency:"GBP",units:20,disposition:"chargeback",chargebackAmountMinor:chargeback,terminalReference:"dp_414"};
await assert.rejects(()=>composition.authority.terminallySettlePreservedValue(coordinates),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_VALUE_DISPOSITION_CALLER_AUTHORITY_REJECTED","without an independent receipt the financial writer must fail closed");
assert.equal(row.chargebackAmountMinor,0,"rejected caller must not mutate accounting");
evidenceAvailable=true;
const settled=await composition.authority.terminallySettlePreservedValue({provider:"stripe",providerPaymentReference:"pi-414",commercialIntentId:"intent-414",principalId:"creator-414",amountMinor:original,currency:"GBP",units:20,disposition:"chargeback",chargebackAmountMinor:chargeback,terminalReference:"dp_414"});
assert.equal(settled.cumulativeRefundedAmountMinor,refunded);
assert.equal(settled.chargebackAmountMinor,chargeback);
assert.equal(settled.remainingAmountMinor,surviving);
assert.equal(refunded+chargeback+settled.remainingAmountMinor,original);
assert.equal(settled.status,"preserved-credit","RED: a partial chargeback leaves surviving customer value, but production marks the whole preserved-value row terminal charged-back and makes that surviving value unreachable to the preserved-credit lifecycle.");
console.log("GREEN: partial chargeback preserves surviving customer value as reachable preserved credit.");
console.log("LAW: A PARTIAL CHARGEBACK MAY EXTINGUISH ONLY THE WITHDRAWN AMOUNT; ANY UNREFUNDED, UNCHARGED-BACK CUSTOMER VALUE MUST REMAIN DURABLY REACHABLE.");
