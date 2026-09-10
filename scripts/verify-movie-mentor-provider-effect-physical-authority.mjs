import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorProviderEffectMongoStore } from "../ai/MovieMentorProviderEffectMongoStore.js";

const storeSource = fs.readFileSync(new URL("../ai/MovieMentorProviderEffectMongoStore.js", import.meta.url), "utf8");
const compositionSource = fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js", import.meta.url), "utf8");

assert.match(storeSource, /schema\.index\(\{providerCallId:1\},\{unique:true\}\)/, "provider effect store must declare providerCallId uniqueness");
assert.match(storeSource, /storeModel\(\)\.create\(c\)/, "provider effect store crosses an irreversible durable UNKNOWN mint");
assert.match(storeSource, /findOneAndUpdate/, "provider effect store crosses durable evidence CAS mutation");
assert.match(compositionSource, /createMovieMentorProviderEffectMongoStore\(\)/, "production inference execution composition must directly compose the durable provider effect store");
assert.match(compositionSource, /beginProviderDispatch:providerBoundaryAuthority\.beginProviderDispatch/, "production authority must expose the provider dispatch path that reaches UNKNOWN mint");

let durableMutations = 0;
const query = value => ({ lean(){ return this; }, exec: async () => value });
const model = {
  collection: { async indexes(){ return [{ name: "_id_", key: { _id: 1 }, unique: true }]; } },
  findOne(){ return query(null); },
  async create(value){ durableMutations += 1; return value; },
  findOneAndUpdate(){ durableMutations += 1; return query(null); },
  find(){ return query([]); },
};
const store = createMovieMentorProviderEffectMongoStore({ mongoModel: model });

await assert.rejects(
  () => store.beginUnknown({
    providerCallId: "call-physical-red",
    executionId: "execution-physical-red",
    slotId: "slot-physical-red",
    task: "story",
    dispatchUnknownAt: "2035-01-01T00:00:00.000Z",
  }),
  error => error?.code === "MOVIE_MENTOR_PROVIDER_EFFECT_PHYSICAL_AUTHORITY_UNAVAILABLE",
  "provider effect authority must fail closed when the physical providerCallId unique index is absent",
);
assert.equal(durableMutations, 0, "missing physical provider effect uniqueness must fail before any durable mutation");

console.log("✓ Production reachability: inference execution composition directly owns provider effect UNKNOWN/evidence mutation authority");
console.log("✓ Provider effect physical authority fails closed before durable mutation when providerCallId uniqueness is absent");
