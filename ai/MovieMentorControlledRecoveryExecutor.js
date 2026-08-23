/**
 * Movie Mentor Controlled Recovery Executor v1.1.0
 * Fail-closed dormant execution contract. No live adapters. No autonomous authority.
 */
const VERSION="1.1.0";
const CONTRACT_VERSION="1.1.0";
const EXECUTOR_ID="controlled-recovery-executor";
const AUTHORITY="operations-approved-recovery-execution-contract-only";
const EXECUTION_STATES=Object.freeze(["approved-intent-ready","denied","expired-authorisation","scope-mismatch","action-not-allowlisted","invalid-authorisation","duplicate-request","execution-adapter-unavailable","execution-succeeded","execution-failed"]);
// Empty by design. Deployment configuration must explicitly supply every allowed action.
const DEFAULT_ALLOWED_ACTION_IDS=Object.freeze([]);
function asArray(v){return Array.isArray(v)?v:[];}function cleanString(v){return typeof v==="string"?v.trim():"";}function cloneValue(v){if(v===undefined)return undefined;try{return JSON.parse(JSON.stringify(v));}catch{return v;}}function parseTime(v){const ms=Date.parse(v);return Number.isFinite(ms)?ms:null;}
function createControlledRecoveryRequest({requestId,actionId,targetScope,parameters={},requestedBy,authorisation={},evidenceReferences=[],idempotencyKey,metadata={}}={}){return{executorId:EXECUTOR_ID,requestId:cleanString(requestId),actionId:cleanString(actionId),targetScope:cloneValue(targetScope),parameters:cloneValue(parameters||{}),requestedBy:cleanString(requestedBy),authorisation:cloneValue(authorisation||{}),evidenceReferences:cloneValue(asArray(evidenceReferences)),idempotencyKey:cleanString(idempotencyKey),metadata:cloneValue(metadata||{}),authority:AUTHORITY,creatorFacing:false,failClosed:true};}

async function validateAuthorisation(authorisation={},request={},now=new Date(),authorisationVerifier=null){
 const issues=[];if(!cleanString(authorisation.approvalId))issues.push("approval_id_required");if(!cleanString(authorisation.actionId))issues.push("approved_action_id_required");if(cleanString(authorisation.actionId)!==request.actionId)issues.push("approved_action_mismatch");if(authorisation.targetScope===undefined||authorisation.targetScope===null)issues.push("approved_scope_required");
 const expiry=parseTime(authorisation.expiresAt);if(expiry===null)issues.push("valid_expiry_required");else if(expiry<=now.getTime())issues.push("authorisation_expired");if(JSON.stringify(request.targetScope??null)!==JSON.stringify(authorisation.targetScope??null))issues.push("approved_scope_mismatch");if(authorisation.revoked===true)issues.push("authorisation_revoked");if(authorisation.explicitApproval!==true)issues.push("explicit_approval_required");
 // Never trust self-asserted approvedBy as proof. A trusted server-side verifier is mandatory.
 if(typeof authorisationVerifier!=="function")issues.push("trusted_authorisation_verifier_required");
 else if(issues.length===0){let verdict;try{verdict=await authorisationVerifier({approvalId:cleanString(authorisation.approvalId),actionId:request.actionId,targetScope:cloneValue(request.targetScope),requestId:request.requestId});}catch{issues.push("trusted_authorisation_verification_failed");return{valid:false,issues};}if(verdict?.valid!==true)issues.push("trusted_authorisation_not_verified");}
 return{valid:issues.length===0,issues};
}

async function validateControlledRecoveryRequest(request={},options={}){
 const {allowedActionIds=DEFAULT_ALLOWED_ACTION_IDS,executionLedger=null,authorisationVerifier=null,now=new Date()}=options;const issues=[];
 if(request.executorId!==EXECUTOR_ID)issues.push("executor_identity_invalid");if(request.authority!==AUTHORITY)issues.push("authority_invalid");if(request.creatorFacing!==false)issues.push("creator_facing_forbidden");if(request.failClosed!==true)issues.push("fail_closed_required");if(!cleanString(request.requestId))issues.push("request_id_required");if(!cleanString(request.actionId))issues.push("action_id_required");if(request.targetScope===undefined||request.targetScope===null)issues.push("target_scope_required");if(!cleanString(request.requestedBy))issues.push("requester_identity_required");if(!cleanString(request.idempotencyKey))issues.push("idempotency_key_required");if(!asArray(allowedActionIds).includes(request.actionId))issues.push("action_not_allowlisted");
 if(!executionLedger||typeof executionLedger.reserve!=="function")issues.push("atomic_execution_ledger_required");
 const auth=await validateAuthorisation(request.authorisation,request,now,authorisationVerifier);issues.push(...auth.issues);return{valid:issues.length===0,issues};
}
function deriveDeniedState(issues=[]){if(issues.includes("action_not_allowlisted"))return"action-not-allowlisted";if(issues.includes("authorisation_expired"))return"expired-authorisation";if(issues.includes("approved_scope_mismatch"))return"scope-mismatch";if(issues.includes("duplicate_request"))return"duplicate-request";if(issues.some(x=>x.includes("authorisation")||x.includes("approval")))return"invalid-authorisation";return"denied";}

async function prepareControlledRecoveryExecutionIntent(request={},options={}){
 const validation=await validateControlledRecoveryRequest(request,options);const now=options.now||new Date();const auditBase={executorId:EXECUTOR_ID,requestId:request.requestId||null,actionId:request.actionId||null,targetScope:cloneValue(request.targetScope),requestedBy:request.requestedBy||null,approvalId:request?.authorisation?.approvalId||null,idempotencyKey:request.idempotencyKey||null,evaluatedAt:now.toISOString()};
 if(!validation.valid)return{success:false,state:deriveDeniedState(validation.issues),executionPermitted:false,issues:validation.issues,auditRecord:{...auditBase,outcome:"denied"}};
 let reserved=false;try{reserved=await options.executionLedger.reserve({key:request.idempotencyKey,requestId:request.requestId,actionId:request.actionId});}catch{return{success:false,state:"denied",executionPermitted:false,issues:["execution_ledger_reservation_failed"],auditRecord:{...auditBase,outcome:"denied"}};}if(reserved!==true)return{success:false,state:"duplicate-request",executionPermitted:false,issues:["duplicate_request"],auditRecord:{...auditBase,outcome:"denied"}};
 const adapter=options.adapterRegistry?.[request.actionId];if(typeof adapter!=="function")return{success:false,state:"execution-adapter-unavailable",executionPermitted:false,issues:["no_live_execution_adapter_registered"],auditRecord:{...auditBase,outcome:"adapter-unavailable"}};
 return{success:true,state:"approved-intent-ready",executionPermitted:true,executionIntent:{actionId:request.actionId,targetScope:cloneValue(request.targetScope),parameters:cloneValue(request.parameters||{}),adapterRegistered:true},auditRecord:{...auditBase,outcome:"approved-intent-ready"}};
}

async function executeControlledRecovery(request={},options={}){
 const prepared=await prepareControlledRecoveryExecutionIntent(request,options);if(!prepared.success||prepared.executionPermitted!==true)return prepared;const adapter=options.adapterRegistry?.[request.actionId];
 try{const result=await adapter({requestId:request.requestId,actionId:request.actionId,targetScope:cloneValue(request.targetScope),parameters:cloneValue(request.parameters||{}),approvalId:request.authorisation.approvalId,idempotencyKey:request.idempotencyKey});return{success:true,state:"execution-succeeded",executionPermitted:true,executed:true,result:cloneValue(result),verificationRequired:true,auditRecord:{...prepared.auditRecord,executedAt:new Date().toISOString(),outcome:"execution-succeeded"}};}
 catch(error){return{success:false,state:"execution-failed",executionPermitted:true,executed:true,verificationRequired:true,issues:[cleanString(error?.code)||"recovery_adapter_execution_failed"],errorMessage:cleanString(error?.message)||"Recovery adapter execution failed.",auditRecord:{...prepared.auditRecord,executedAt:new Date().toISOString(),outcome:"execution-failed"}};}
}
function getControlledRecoveryExecutorManifest(){return{id:EXECUTOR_ID,name:"Movie Mentor Controlled Recovery Executor",version:VERSION,contractVersion:CONTRACT_VERSION,status:"standalone-dormant-no-live-adapters",authority:AUTHORITY,creatorFacing:false,autonomousAuthority:false,failClosed:true,defaultAllowedActionIds:DEFAULT_ALLOWED_ACTION_IDS,requirements:["explicit-empty-by-default-allowlist","trusted-server-authorisation-verifier","exact-scope-match","unexpired-authorisation","atomic-idempotency-ledger","registered-execution-adapter","audit-record","mandatory-post-execution-verification"],restrictions:["cannot-self-approve","cannot-trust-self-asserted-approver-identity","cannot-expand-authority","no-live-production-adapters-in-v1"]};}
export{VERSION as CONTROLLED_RECOVERY_EXECUTOR_VERSION,CONTRACT_VERSION as CONTROLLED_RECOVERY_EXECUTOR_CONTRACT_VERSION,EXECUTOR_ID as CONTROLLED_RECOVERY_EXECUTOR_ID,AUTHORITY as CONTROLLED_RECOVERY_EXECUTOR_AUTHORITY,EXECUTION_STATES,DEFAULT_ALLOWED_ACTION_IDS,createControlledRecoveryRequest,validateAuthorisation,validateControlledRecoveryRequest,prepareControlledRecoveryExecutionIntent,executeControlledRecovery,getControlledRecoveryExecutorManifest};export default executeControlledRecovery;
