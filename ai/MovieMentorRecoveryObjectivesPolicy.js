/**
 * Movie Mentor Recovery Objectives Policy (RPO / RTO)
 * ---------------------------------------------------
 * Deterministic disaster-recovery objective contract.
 *
 * RPO = maximum targeted recoverable data-loss window.
 * RTO = maximum targeted service restoration window.
 *
 * STATUS:
 * - Standalone architecture only.
 * - Targets are PROVISIONAL until production capacity/cost testing validates them.
 * - NOT wired to backups, databases, monitoring, deployment or infrastructure.
 * - NOT an AI agent and grants no execution authority.
 */

const VERSION="1.0.0";
const CONTRACT_VERSION="1.0.0";
const POLICY_ID="movie-mentor-recovery-objectives-policy";
const AUTHORITY="recovery-objectives-policy-contract-only";

const RECOVERY_TIERS=Object.freeze({
  "creator-active-state":Object.freeze({priority:1,rpoSeconds:30,rtoSeconds:900,description:"Active creator conversation/project state and recoverable checkpoints.",provisional:true}),
  "creator-project-persistence":Object.freeze({priority:1,rpoSeconds:300,rtoSeconds:1800,description:"Persisted creator projects, drafts and project metadata.",provisional:true}),
  "core-mentor-service":Object.freeze({priority:1,rpoSeconds:null,rtoSeconds:1800,description:"Core Movie Mentor creator-facing service availability; RPO is not applicable to stateless service execution.",provisional:true}),
  "authentication-access":Object.freeze({priority:1,rpoSeconds:300,rtoSeconds:1800,description:"Creator authentication/access dependencies where controlled by Movie Mentor infrastructure.",provisional:true}),
  "operations-control-plane":Object.freeze({priority:2,rpoSeconds:300,rtoSeconds:3600,description:"Internal Operations control, incident and recovery capability.",provisional:true}),
  "operations-audit-ledger":Object.freeze({priority:1,rpoSeconds:0,rtoSeconds:3600,description:"Incident audit history target: no acknowledged ledger entry loss once durably committed.",provisional:true}),
  "public-status-capability":Object.freeze({priority:1,rpoSeconds:null,rtoSeconds:300,description:"Externally hosted public outage/status capability intended to remain independent of the primary application failure domain.",provisional:true}),
  "analytics-reporting":Object.freeze({priority:3,rpoSeconds:3600,rtoSeconds:14400,description:"Non-critical analytics and reporting workloads.",provisional:true}),
});

function cleanString(v){return typeof v==="string"?v.trim():""}
function cloneValue(v){if(v===undefined)return undefined;try{return JSON.parse(JSON.stringify(v))}catch{return v}}
function getRecoveryTier(tierId){const id=cleanString(tierId);return id&&RECOVERY_TIERS[id]?cloneValue(RECOVERY_TIERS[id]):null}
function listRecoveryTiers(){return Object.entries(RECOVERY_TIERS).map(([tierId,v])=>({tierId,...cloneValue(v)})).sort((a,b)=>a.priority-b.priority||a.tierId.localeCompare(b.tierId))}

function evaluateRecoveryObjective({tierId,observedDataLossSeconds=null,observedRestorationSeconds=null}={}){
  const tier=getRecoveryTier(tierId);if(!tier)return{valid:false,tierId:cleanString(tierId)||null,reasons:["unknown_recovery_tier"]};
  const reasons=[];
  const dataLossKnown=Number.isFinite(observedDataLossSeconds)&&observedDataLossSeconds>=0;
  const restorationKnown=Number.isFinite(observedRestorationSeconds)&&observedRestorationSeconds>=0;
  let rpoStatus="not-applicable",rtoStatus="unknown";
  if(tier.rpoSeconds!==null){if(!dataLossKnown){rpoStatus="unknown";reasons.push("observed_data_loss_required")}else rpoStatus=observedDataLossSeconds<=tier.rpoSeconds?"met":"breached"}
  if(!restorationKnown){reasons.push("observed_restoration_time_required")}else rtoStatus=observedRestorationSeconds<=tier.rtoSeconds?"met":"breached";
  return{valid:reasons.length===0,tierId:cleanString(tierId),priority:tier.priority,provisional:tier.provisional,targetRpoSeconds:tier.rpoSeconds,targetRtoSeconds:tier.rtoSeconds,observedDataLossSeconds:dataLossKnown?observedDataLossSeconds:null,observedRestorationSeconds:restorationKnown?observedRestorationSeconds:null,rpoStatus,rtoStatus,objectiveMet:(rpoStatus==="met"||rpoStatus==="not-applicable")&&rtoStatus==="met",reasons};
}

function validateRecoveryObjectivesPolicy(){const issues=[];for(const [id,tier] of Object.entries(RECOVERY_TIERS)){if(!Number.isInteger(tier.priority)||tier.priority<1)issues.push(`priority_invalid:${id}`);if(tier.rpoSeconds!==null&&(!Number.isFinite(tier.rpoSeconds)||tier.rpoSeconds<0))issues.push(`rpo_invalid:${id}`);if(!Number.isFinite(tier.rtoSeconds)||tier.rtoSeconds<=0)issues.push(`rto_invalid:${id}`);if(tier.provisional!==true)issues.push(`production_validation_flag_required:${id}`)}return{valid:issues.length===0,issues,tierCount:Object.keys(RECOVERY_TIERS).length}}

function getRecoveryObjectivesPolicyManifest(){return{id:POLICY_ID,name:"Movie Mentor Recovery Objectives Policy",version:VERSION,contractVersion:CONTRACT_VERSION,status:"standalone-dormant-provisional-not-wired",authority:AUTHORITY,deterministicControl:true,aiAgent:false,targetsProvisional:true,tierCount:Object.keys(RECOVERY_TIERS).length,principles:["protect-active-creator-state-first","restore-core-creator-access-before-non-critical-analytics","public-status-capability-belongs-outside-primary-failure-domain","acknowledged-audit-records-target-zero-loss-after-durable-commit","production-targets-must-be-validated-against-real-cost-capacity-and-backup-testing"],restrictions:["does-not-guarantee-zero-data-loss","does-not-guarantee-restoration-deadlines","cannot-execute-backup-or-restore","cannot-create-operational-authority","no-live-backup-database-monitoring-or-infrastructure-adapters","targets-must-be-reviewed-before-production-activation"]}}

export{VERSION as RECOVERY_OBJECTIVES_POLICY_VERSION,CONTRACT_VERSION as RECOVERY_OBJECTIVES_POLICY_CONTRACT_VERSION,POLICY_ID as RECOVERY_OBJECTIVES_POLICY_ID,AUTHORITY as RECOVERY_OBJECTIVES_POLICY_AUTHORITY,RECOVERY_TIERS,getRecoveryTier,listRecoveryTiers,evaluateRecoveryObjective,validateRecoveryObjectivesPolicy,getRecoveryObjectivesPolicyManifest};
export default evaluateRecoveryObjective;
