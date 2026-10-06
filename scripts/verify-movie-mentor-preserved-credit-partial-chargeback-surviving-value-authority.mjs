import assert from "node:assert/strict";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";

console.log("Movie Mentor partial-chargeback surviving-value authority court");

const original=1200,refunded=500,chargeback=300,surviving=400;
let row={provider:"stripe",providerPaymentReference:"pi-414",commercialIntentId:"intent-414",principalId:"creator-414",amountMinor:original,currency:"GBP",units:20,reason:"entitlement-suspended",refundAuthorized:false,cumulativeRefundedAmountMinor:refunded,remainingAmountMinor:original-refunded,lastRefundReference:"re_414",chargebackAmountMinor:0,status:"preserved-credit",terminalDisposition:null,terminalReference:null,preservedAt:new Date()};
const leanExec=v=>({lean:()=>({exec:async()=>v})});
const model={
 createIndexes:async()=>{},collection:{indexes:async()=>[{unique:true,key:{provider:1,providerPaymentReference:1}}]},
 findOne:()=>leanExec(row),
 findOneAndUpdate:(q,u)=>leanExec((()=>{if(row.status!==q.status)return null;row={...row,...u.$set};return row;})())
};
const composition=createMovieMentorProductionCommercialValueDispositionComposition({injectedModel:model});
assert.equal(composition.ready,true);
const settled=await composition.authority.terminallySettlePreservedValue({provider:"stripe",providerPaymentReference:"pi-414",commercialIntentId:"intent-414",principalId:"creator-414",amountMinor:original,currency:"GBP",units:20,disposition:"chargeback",chargebackAmountMinor:chargeback,terminalReference:"dp_414"});
assert.equal(settled.cumulativeRefundedAmountMinor,refunded);
assert.equal(settled.chargebackAmountMinor,chargeback);
assert.equal(settled.remainingAmountMinor,surviving);
assert.equal(refunded+chargeback+settled.remainingAmountMinor,original);
assert.equal(settled.status,"preserved-credit","RED: a partial chargeback leaves surviving customer value, but production marks the whole preserved-value row terminal charged-back and makes that surviving value unreachable to the preserved-credit lifecycle.");
console.log("GREEN: partial chargeback preserves surviving customer value as reachable preserved credit.");
console.log("LAW: A PARTIAL CHARGEBACK MAY EXTINGUISH ONLY THE WITHDRAWN AMOUNT; ANY UNREFUNDED, UNCHARGED-BACK CUSTOMER VALUE MUST REMAIN DURABLY REACHABLE.");
