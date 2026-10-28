import assert from "node:assert/strict";

// AUD-OPEN-01 design court. Pure isolated model: no Mongo connection, no production writes.
// The physical Mongo courts remain the authority for a real repair.
// An ID allocated before commit cannot act as a commit-order watermark.
function page(ids,limit,cursor=null){
 const visible=ids.filter(id=>cursor===null||id>cursor).sort();
 return {receipts:visible.slice(0,limit),nextCursor:visible.length>limit?visible[limit-1]:null};
}
function scan(ids,limit){
 let cursor=null;const found=[];
 for(let i=0;i<=ids.length;i++){
  const p=page(ids,limit,cursor);found.push(...p.receipts);
  if(p.nextCursor===null)return found;
  assert.ok(cursor===null||p.nextCursor>cursor,"cursor must advance");
  cursor=p.nextCursor;
 }
 assert.fail("bounded scan must terminate");
}
const permutations=[
 {early:"0-a",later:["1-b","2-c"]},
 {early:"000000000000000000000001",later:["000000000000000000000002","000000000000000000000003"]}
];
for(const {early,later} of permutations){
 for(const limit of [1,2,50]){
  const first=scan(later,limit);
  assert.equal(first.includes(early),false,"uncommitted receipt is invisible");
  const afterCommit=page([...later,early],limit,later[0]);
  assert.equal(afterCommit.receipts.includes(early),false,"monotone cursor cannot discover a committed lower ID");
  const replay=scan([...later,early],limit);
  assert.ok(replay.includes(early),"a new bounded full replay discovers a late commit");
  assert.equal(new Set(replay).size,replay.length,"one scan must not duplicate receipts");
 }
}
// A finite replay cannot discover an arbitrarily later commit. A separate autonomous
// re-trigger/liveness contract and durable idempotent settlement remain necessary.
const futureCommitAfterFinalReplay=true;
assert.equal(futureCommitAfterFinalReplay,true);
console.log("DESIGN COURT GREEN (MODEL ONLY): monotone cursor fails late commits; bounded full replay discovers committed earlier IDs; autonomous liveness and physical financial safety still unproven.");
