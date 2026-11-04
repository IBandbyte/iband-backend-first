import assert from "node:assert/strict";
import fs from "node:fs";

// Source inventory only: do not conflate declared Mongoose immutability with
// a database-enforced prohibition against direct Mongo writes.
const registry=fs.readFileSync(new URL("../ai/MovieMentorProjectOwnershipRegistry.js",import.meta.url),"utf8");
const composition=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateAtomicComposition.js",import.meta.url),"utf8");
const readiness=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateAtomicReadiness.js",import.meta.url),"utf8");
assert.match(registry,/ownershipTransfer:\s*false/,"Ownership authority must advertise no supported transfer.");
assert.match(registry,/ownerPrincipalId:\s*\{[^}]*immutable:\s*true/,"Owner identity must be immutable in registry schema.");
assert.match(registry,/ownershipReference:\s*\{[^}]*immutable:\s*true/,"Ownership reference must be immutable in registry schema.");
assert.match(registry,/ownershipRevision:\s*1/,"New ownership starts at revision 1.");
assert.match(registry,/getModel\(\)\.create\(candidate\)/,"Registry mint path must be create-only.");
for(const mutation of [".updateOne(",".updateMany(",".findOneAndUpdate(",".replaceOne(",".deleteOne(",".deleteMany(",".findOneAndDelete("]){
 assert.ok(!registry.includes(mutation),`RED: ownership registry unexpectedly exposes mutation ${mutation}`);
}
assert.match(composition,/db\.client!==client/,"Canonical Mongo composition must reject client mismatch.");
assert.match(readiness,/createMongoCreatorStateAtomicAccept\(\{client,states,operations\}\)/,"Current atomic readiness must expose exact state and ledger.");
console.log("GREEN: registered ownership module is create-only, transfer-disabled, and creator-state composition shares canonical state/ledger client.");
console.log("LIMITATION: source inventory does not rule out direct MongoDB writes, external administrative mutations, or future revocation paths.");
