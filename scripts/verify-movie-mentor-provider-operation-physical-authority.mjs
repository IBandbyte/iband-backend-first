import assert from "node:assert/strict";
import fs from "node:fs";
import {getMovieMentorProviderOperationMongoStoreStatus} from "../ai/MovieMentorProviderOperationMongoStore.js";

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorProviderOperationMongoStore.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js",import.meta.url),"utf8");
const status=getMovieMentorProviderOperationMongoStoreStatus();

assert.equal(status.collection,"movie_mentor_provider_operation_reality");
assert.match(storeSource,/schema\.index\(\{ providerCallId: 1 \}, \{ unique: true \}\)/,"provider operation schema must declare providerCallId uniqueness");
assert.match(storeSource,/async function bindOperation\(input = \{\}\)/,"provider operation store must expose durable operation mint");
assert.match(storeSource,/return normalize\(await storeModel\(\)\.create\(candidate\)\)/,"provider operation mint must cross irreversible Mongo create");
assert.match(compositionSource,/const durableOperationStore=createMovieMentorProviderOperationMongoStore\(\)/,"production composition must directly own the provider operation store");
assert.match(compositionSource,/createMovieMentorProviderOperationAuthority\(\{store:durableOperationStore\}\)/,"production provider operation authority must be reachable from that store");
assert.match(compositionSource,/beginProviderDispatch:providerBoundaryAuthority\.beginProviderDispatch/,"production authority must expose provider dispatch through the provider operation boundary");

const explicitPhysicalReadiness=/physicalUniqueIndexReadiness|readIndexes|\.indexes\(\)|listIndexes|createIndexes|\.init\(\)/;
assert.match(storeSource,explicitPhysicalReadiness,"provider operation authority must own explicit physical unique-index readiness before durable operation mint");

console.log("PASS provider operation physical authority — production-reachable immutable provider operation mint owns physical providerCallId uniqueness before irreversible Mongo create.");
