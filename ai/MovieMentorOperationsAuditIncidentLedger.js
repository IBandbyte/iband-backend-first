/**
 * Movie Mentor Operations Audit + Incident Ledger
 * ------------------------------------------------
 * Deterministic append-only incident flight-recorder contract.
 *
 * STATUS:
 * - Standalone architecture only.
 * - NOT wired to a database, runtime, monitoring or infrastructure.
 * - NOT an AI agent.
 * - Records evidence and decisions; grants no operational authority.
 */

import { createHash } from "node:crypto";

const VERSION = "1.0.0";
const CONTRACT_VERSION = "1.0.0";
const LEDGER_ID = "operations-audit-incident-ledger";
const AUTHORITY = "operations-audit-recording-only";
const GENESIS_HASH = "GENESIS";

const EVENT_TYPES = Object.freeze([
  "incident-opened",
  "observation-recorded",
  "agent-contribution-recorded",
  "agent-admission-denied",
  "agent-quarantined",
  "agent-release-requested",
  "agent-released",
  "diagnosis-recorded",
  "state-transition-requested",
  "state-transition-permitted",
  "state-transition-denied",
  "recovery-requested",
  "recovery-authorised",
  "recovery-denied",
  "recovery-execution-started",
  "recovery-execution-completed",
  "recovery-execution-failed",
  "recovery-verification-recorded",
  "rollback-requested",
  "rollback-authorised",
  "rollback-denied",
  "rollback-execution-started",
  "rollback-execution-completed",
  "rollback-execution-failed",
  "rollback-verification-recorded",
  "creator-state-preservation-recorded",
  "creator-state-restoration-requested",
  "creator-state-restoration-recorded",
  "external-outage-recorded",
  "public-status-recorded",
  "human-review-requested",
  "incident-note-recorded",
  "incident-closed",
]);

function cleanString(value){return typeof value==="string"?value.trim():""}
function cloneValue(value){if(value===undefined)return undefined;try{return JSON.parse(JSON.stringify(value))}catch{return value}}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==="object"){return Object.keys(value).sort().reduce((o,k)=>{o[k]=stable(value[k]);return o},{});}return value}
function digest(value){return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex")}

function createIncidentLedger({incidentId,openedAt=null,metadata={}}={}){
  const id=cleanString(incidentId);if(!id)throw new Error("incidentId is required.");
  return {ledgerId:LEDGER_ID,incidentId:id,openedAt:cleanString(openedAt)||null,authority:AUTHORITY,appendOnly:true,entries:[],headHash:GENESIS_HASH,metadata:cloneValue(metadata||{})};
}

function validateLedger(ledger={}){
  const issues=[];
  if(ledger.ledgerId!==LEDGER_ID)issues.push("ledger_identity_invalid");
  if(!cleanString(ledger.incidentId))issues.push("incident_id_required");
  if(ledger.authority!==AUTHORITY)issues.push("ledger_authority_invalid");
  if(ledger.appendOnly!==true)issues.push("append_only_required");
  if(!Array.isArray(ledger.entries))issues.push("entries_array_required");
  if(issues.length)return{valid:false,issues};
  let previousHash=GENESIS_HASH;
  for(let i=0;i<ledger.entries.length;i++){
    const entry=ledger.entries[i];
    if(entry.sequence!==i+1)issues.push(`sequence_invalid:${i+1}`);
    if(entry.previousHash!==previousHash)issues.push(`previous_hash_invalid:${i+1}`);
    const unsigned={...entry};delete unsigned.entryHash;
    const expected=digest(unsigned);
    if(entry.entryHash!==expected)issues.push(`entry_hash_invalid:${i+1}`);
    previousHash=entry.entryHash;
  }
  if(ledger.headHash!==previousHash)issues.push("head_hash_invalid");
  return{valid:issues.length===0,issues,count:ledger.entries.length,headHash:ledger.headHash};
}

function appendIncidentEvent(ledger={}, {
  eventType,
  occurredAt=null,
  actorRuntimeIdentity=null,
  source=null,
  summary=null,
  evidence=[],
  references={},
  decision=null,
  authorityReference=null,
  metadata={},
}={}){
  const integrity=validateLedger(ledger);if(!integrity.valid){const e=new Error("Incident ledger failed integrity validation.");e.code="OPERATIONS_LEDGER_INTEGRITY_INVALID";e.validationIssues=integrity.issues;throw e;}
  const type=cleanString(eventType);if(!EVENT_TYPES.includes(type)){const e=new Error(`Unknown incident event type: ${type||"missing"}`);e.code="OPERATIONS_LEDGER_EVENT_TYPE_INVALID";throw e;}
  const previousHash=ledger.headHash||GENESIS_HASH;
  const unsigned={
    ledgerId:LEDGER_ID,
    incidentId:ledger.incidentId,
    sequence:ledger.entries.length+1,
    eventType:type,
    occurredAt:cleanString(occurredAt)||null,
    actorRuntimeIdentity:cleanString(actorRuntimeIdentity)||null,
    source:cleanString(source)||null,
    summary:cleanString(summary)||null,
    evidence:Array.isArray(evidence)?cloneValue(evidence):[],
    references:cloneValue(references||{}),
    decision:cloneValue(decision),
    authorityReference:cleanString(authorityReference)||null,
    metadata:cloneValue(metadata||{}),
    previousHash,
  };
  const entry={...unsigned,entryHash:digest(unsigned)};
  return {...cloneValue(ledger),entries:[...ledger.entries,entry],headHash:entry.entryHash};
}

function verifyIncidentLedger(ledger={}){return validateLedger(ledger)}

function getIncidentTimeline(ledger={}){
  const integrity=validateLedger(ledger);if(!integrity.valid)return{valid:false,issues:integrity.issues,timeline:[]};
  return{valid:true,issues:[],timeline:ledger.entries.map(e=>({sequence:e.sequence,eventType:e.eventType,occurredAt:e.occurredAt,actorRuntimeIdentity:e.actorRuntimeIdentity,summary:e.summary,authorityReference:e.authorityReference,entryHash:e.entryHash}))};
}

function getOperationsAuditIncidentLedgerManifest(){return{id:LEDGER_ID,name:"Movie Mentor Operations Audit + Incident Ledger",version:VERSION,contractVersion:CONTRACT_VERSION,status:"standalone-dormant-not-wired",authority:AUTHORITY,deterministicControl:true,aiAgent:false,appendOnly:true,hashLinked:true,hashAlgorithm:"sha256",eventTypes:EVENT_TYPES,capabilities:["append-only-incident-recording","hash-linked-tamper-evidence","ordered-event-sequencing","authorisation-reference-recording","recovery-and-rollback-flight-recording","quarantine-flight-recording","creator-state-recovery-flight-recording","external-outage-and-public-status-recording"],restrictions:["cannot-authorise-actions","cannot-execute-recovery-or-rollback","cannot-quarantine-or-release-agents","cannot-rewrite-existing-history-through-api-contract","no-live-persistence-adapter","no-secrets-required-in-evidence","production-storage-must-add-access-control-retention-backup-and-immutable-storage-policy"]}}

export {VERSION as OPERATIONS_AUDIT_LEDGER_VERSION,CONTRACT_VERSION as OPERATIONS_AUDIT_LEDGER_CONTRACT_VERSION,LEDGER_ID as OPERATIONS_AUDIT_LEDGER_ID,AUTHORITY as OPERATIONS_AUDIT_LEDGER_AUTHORITY,GENESIS_HASH as OPERATIONS_AUDIT_LEDGER_GENESIS_HASH,EVENT_TYPES as OPERATIONS_AUDIT_EVENT_TYPES,createIncidentLedger,appendIncidentEvent,verifyIncidentLedger,getIncidentTimeline,getOperationsAuditIncidentLedgerManifest};
export default appendIncidentEvent;
