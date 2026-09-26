import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor reservation population ↔ aggregate ledger conservation authority court");

const spend=fs.readFileSync(new URL("../ai/MovieMentorInferenceSpendMongoStore.js",import.meta.url),"utf8");
const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const issuance=fs.readFileSync(new URL("../ai/MovieMentorEntitlementIssuanceMongoStore.js",import.meta.url),"utf8");
const reversal=fs.readFileSync(new URL("../ai/MovieMentorCommercialReversalMongoStore.js",import.meta.url),"utf8");

assert.match(spend,/\$inc:\{remainingUnits:-n\.units,reservedUnits:n\.units,entitlementRevision:1\}/);
assert.match(spend,/Reservation\.create\(\[\{domain:DOMAIN,schema:SCHEMA,\.\.\.n,entitlementRevision:entitlement\.entitlementRevision,status:"reserved"/);
const terminalMoves=[...settlement.matchAll(/\$inc:\{reservedUnits:-reservation\.units,(remainingUnits|consumedUnits):reservation\.units,entitlementRevision:1\}/g)];
assert.ok(terminalMoves.length>=3,"every terminal family must move the exact reservation units out of aggregate reserved accounting");
assert.doesNotMatch(issuance,/reservedUnits:[+-]?[a-zA-Z]/,"issuance must not mutate existing reserved balance");
assert.doesNotMatch(reversal,/\$inc:\{[^}]*reservedUnits/,"reversal must not mutate reserved balance");

function invariant(s){return s.reservedUnits===Object.values(s.reservations).filter(r=>r.status==="reserved").reduce((n,r)=>n+r.units,0);}
function reserve(s,id,units){assert.ok(s.remainingUnits>=units);s.remainingUnits-=units;s.reservedUnits+=units;s.revision++;s.reservations[id]={units,status:"reserved"};assert.ok(invariant(s));}
function terminal(s,id,fate){const r=s.reservations[id];if(!r||r.status!=="reserved")return false;s.reservedUnits-=r.units;if(fate==="consumed")s.consumedUnits+=r.units;else s.remainingUnits+=r.units;s.revision++;r.status=fate;assert.ok(invariant(s));return true;}
function issue(s,units){s.remainingUnits+=units;s.revision++;assert.ok(invariant(s));}
function suspend(s){s.status="suspended";s.revision++;assert.ok(invariant(s));}

const s={status:"active",remainingUnits:10,reservedUnits:0,consumedUnits:0,revision:1,reservations:{}};
reserve(s,"A",2);reserve(s,"B",3);issue(s,4);terminal(s,"B","consumed");suspend(s);terminal(s,"A","released");
assert.ok(invariant(s));
assert.deepEqual({remaining:s.remainingUnits,reserved:s.reservedUnits,consumed:s.consumedUnits,status:s.status},{remaining:11,reserved:0,consumed:3,status:"suspended"});

const t={status:"active",remainingUnits:6,reservedUnits:0,consumedUnits:0,revision:1,reservations:{}};
reserve(t,"A",1);reserve(t,"B",1);terminal(t,"A","released");reserve(t,"C",2);
assert.equal(terminal(t,"A","consumed"),false,"terminal A cannot consume aggregate value belonging to still-reserved B/C");
assert.ok(invariant(t));
terminal(t,"C","consumed");terminal(t,"B","released");assert.ok(invariant(t));

console.log("GREEN: every modeled production writer preserves aggregate reservedUnits == sum of exact durable reserved reservation obligations across mixed lifecycle orderings.");
console.log("LAW: AGGREGATE RESERVED BALANCE IS CONSERVED BY THE DURABLE RESERVED RESERVATION POPULATION; NON-RESERVATION AUTHORITY MAY CHANGE LEDGER CHRONOLOGY BUT MAY NOT CREATE OR DESTROY RESERVED OBLIGATIONS.");
