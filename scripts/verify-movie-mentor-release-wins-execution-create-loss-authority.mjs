import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorInferenceSpendAuthority } from "../ai/MovieMentorInferenceSpendAuthority.js";

console.log("Movie Mentor release-wins execution-create-loss authority court");

const principalId="creator-release-wins", projectId="project-release-wins", creatorTurnId="turn-release-wins";
const serverAuthority={authenticated:true,projectAuthorized:true,principalId,projectId};
let durable=null, reserveCalls=0, entitlementDebits=0;

const store={
  async reserve(request){
    reserveCalls+=1;
    if(durable){
      if(durable.reservationId!==request.reservationId) throw new Error("same stable turn minted a second reservation identity");
      if(durable.status!=="reserved"){
        const error=new Error("Settled inference spend authority cannot be reserved again.");
        error.code="MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_SETTLED";
        throw error;
      }
      return {granted:true,idempotent:true,reservation:structuredClone(durable)};
    }
    entitlementDebits+=request.units;
    durable={domain:"iband.movie-mentor.inference-spend",schema:1,...structuredClone(request),entitlementRevision:1,status:"reserved",reservedAt:"2030-01-01T00:00:00.000Z"};
    return {granted:true,idempotent:false,reservation:structuredClone(durable)};
  },
  async readReservation(id){return durable?.reservationId===id?structuredClone(durable):null;}
};

const authority=createMovieMentorInferenceSpendAuthority({store});
const first=await authority.reserveTurn({serverAuthority,projectId,creatorTurnId});
assert.equal(first.authorized,true);
assert.equal(first.status,"reserved");
assert.equal(entitlementDebits,1);

durable={...durable,status:"released",settledAt:"2030-01-01T00:00:01.000Z",settlementReason:"unbound-execution-release"};

await assert.rejects(
  ()=>authority.reserveTurn({serverAuthority,projectId,creatorTurnId}),
  error=>error?.code==="MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_SETTLED",
  "RED: after release wins the execution-create race, retrying the same stable Creator turn must not resurrect or remint released spend authority."
);
assert.equal(entitlementDebits,1,"RED: same-turn retry after release must not debit Creator value again.");
assert.equal(reserveCalls,2);
const historical=await authority.readReservation({reservationId:first.reservationId,principalId,projectId});
assert.equal(historical.authorized,true);
assert.equal(historical.status,"released");
assert.equal(historical.reservationId,first.reservationId);

const spendStore=fs.readFileSync(new URL("../ai/MovieMentorInferenceSpendMongoStore.js",import.meta.url),"utf8");
const executionStore=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
assert.match(spendStore,/if\(durable\.status!==\"reserved\"\)fail\(\"MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_SETTLED\"/);
assert.match(executionStore,/MOVIE_MENTOR_INFERENCE_EXECUTION_RESERVATION_NOT_RESERVED/);
assert.match(executionStore,/MOVIE_MENTOR_INFERENCE_EXECUTION_RESERVATION_BINDING_RACE/);

console.log("GREEN: release-winning execution-create loss leaves the deterministic Creator-turn reservation terminal; same-turn retry cannot resurrect it or mint a second debit universe.");
console.log("LAW: A RELEASED DETERMINISTIC CREATOR-TURN RESERVATION IS TERMINAL HISTORY; RETRY OF THAT SAME TURN MAY NOT REMINT COMMERCIAL AUTHORITY.");
