/**
 * Movie Mentor Canonical Agent Registry
 * -------------------------------------
 * Deterministic identity and contract catalogue for Movie Mentor agents.
 *
 * STATUS:
 * - Standalone architecture only.
 * - NOT wired to live runtime admission yet.
 * - NOT an AI agent.
 * - Agents cannot self-register or mutate this registry.
 */

const VERSION = "1.0.0";
const CONTRACT_VERSION = "1.0.0";
const REGISTRY_ID = "movie-mentor-canonical-agent-registry";
const AUTHORITY = "canonical-agent-registry-contract-only";

const entries = [
  ["workflow-health-bottleneck","MovieMentorWorkflowHealthBottleneckAgent.js","operations","operations-analysis-only"],
  ["queue-job-health","MovieMentorQueueJobHealthAgent.js","operations","operations-analysis-only"],
  ["latency-performance","MovieMentorLatencyPerformanceAgent.js","operations","operations-analysis-only"],
  ["provider-availability-resilience","MovieMentorProviderAvailabilityResilienceAgent.js","operations","operations-analysis-only"],
  ["capacity-demand","MovieMentorCapacityDemandAgent.js","operations","operations-analysis-only"],
  ["incident-evidence-timeline","MovieMentorIncidentEvidenceTimelineAgent.js","operations","operations-analysis-only"],
  ["service-reliability-recovery-readiness","MovieMentorServiceReliabilityRecoveryReadinessAgent.js","operations","operations-analysis-only"],
  ["operational-change-risk","MovieMentorOperationalChangeRiskAgent.js","operations","operations-analysis-only"],
  ["operational-quality-sla","MovieMentorOperationalQualitySLAAgent.js","operations","operations-analysis-only"],
  ["creator-journey-operations","MovieMentorCreatorJourneyOperationsAgent.js","operations","operations-analysis-only"],
  ["operations-cost-efficiency","MovieMentorOperationsCostEfficiencyAgent.js","operations","operations-analysis-only"],
  ["operations-forecast-early-warning","MovieMentorOperationsForecastEarlyWarningAgent.js","operations","operations-analysis-only"],
  ["root-cause-problem-management","MovieMentorRootCauseProblemManagementAgent.js","operations","operations-analysis-only"],
  ["operations-knowledge-runbook","MovieMentorOperationsKnowledgeRunbookAgent.js","operations","operations-analysis-only"],
  ["operations-governance-control-assurance","MovieMentorOperationsGovernanceControlAssuranceAgent.js","operations","operations-analysis-only"],
  ["recovery-verification","MovieMentorRecoveryVerificationAgent.js","operations","operations-verification-only"],
  ["post-rollback-verification","MovieMentorPostRollbackVerificationAgent.js","operations","operations-verification-only"],
  ["agent-health-integrity","MovieMentorAgentHealthIntegrityAgent.js","operations","operations-agent-health-integrity-analysis-only"],
];

const CANONICAL_AGENT_REGISTRY = Object.freeze(Object.fromEntries(entries.map(([agentId,modulePath,department,authority])=>[
  agentId,
  Object.freeze({
    agentId,
    modulePath:`ai/${modulePath}`,
    department,
    authority,
    enabled:true,
    creatorFacing:false,
    readOnly:true,
    trustedRuntimeIdentity:agentId,
    versionPolicy:"module-manifest-authoritative",
    contractVersionPolicy:"module-manifest-authoritative",
    quarantineManagedExternally:true,
  })
])));

function cleanString(value){return typeof value==="string"?value.trim():""}
function cloneValue(value){if(value===undefined)return undefined;try{return JSON.parse(JSON.stringify(value))}catch{return value}}
function getCanonicalAgent(agentId){const id=cleanString(agentId);return id&&CANONICAL_AGENT_REGISTRY[id]?cloneValue(CANONICAL_AGENT_REGISTRY[id]):null}
function isCanonicalAgent(agentId){return Boolean(getCanonicalAgent(agentId))}
function listCanonicalAgents({department=null,enabledOnly=false}={}){const dept=cleanString(department);return Object.values(CANONICAL_AGENT_REGISTRY).filter(x=>(!dept||x.department===dept)&&(!enabledOnly||x.enabled===true)).map(cloneValue)}
function createAdmissionRegistryView({department=null}={}){return Object.fromEntries(listCanonicalAgents({department,enabledOnly:true}).map(x=>[x.trustedRuntimeIdentity,{enabled:true,authority:x.authority,modulePath:x.modulePath,agentId:x.agentId,versionPolicy:x.versionPolicy,contractVersionPolicy:x.contractVersionPolicy}]))}
function validateCanonicalRuntimeIdentity({trustedRuntimeIdentity=null,claimedAgentIdentity=null}={}){const trusted=cleanString(trustedRuntimeIdentity),claimed=cleanString(claimedAgentIdentity);if(!trusted)return{valid:false,reasons:["trusted_runtime_identity_required"]};const entry=CANONICAL_AGENT_REGISTRY[trusted];if(!entry)return{valid:false,reasons:["unknown_trusted_runtime_identity"]};if(entry.enabled!==true)return{valid:false,reasons:["canonical_agent_disabled"]};if(claimed&&claimed!==trusted)return{valid:false,reasons:["claimed_identity_mismatch"]};return{valid:true,reasons:[],agent:cloneValue(entry)}}
function validateRegistryIntegrity(){const issues=[];const ids=Object.keys(CANONICAL_AGENT_REGISTRY);if(new Set(ids).size!==ids.length)issues.push("duplicate_agent_identity");for(const [id,entry] of Object.entries(CANONICAL_AGENT_REGISTRY)){if(entry.agentId!==id)issues.push(`identity_key_mismatch:${id}`);if(entry.trustedRuntimeIdentity!==id)issues.push(`runtime_identity_mismatch:${id}`);if(entry.creatorFacing!==false)issues.push(`creator_facing_forbidden:${id}`);if(entry.readOnly!==true)issues.push(`read_only_required:${id}`);if(!cleanString(entry.modulePath))issues.push(`module_path_missing:${id}`);if(!cleanString(entry.authority))issues.push(`authority_missing:${id}`)}return{valid:issues.length===0,issues,count:ids.length}}
function getCanonicalAgentRegistryManifest(){return{id:REGISTRY_ID,name:"Movie Mentor Canonical Agent Registry",version:VERSION,contractVersion:CONTRACT_VERSION,status:"standalone-dormant-not-wired",authority:AUTHORITY,deterministicControl:true,aiAgent:false,failClosed:true,agentCount:Object.keys(CANONICAL_AGENT_REGISTRY).length,departments:[...new Set(Object.values(CANONICAL_AGENT_REGISTRY).map(x=>x.department))],restrictions:["agents-cannot-self-register","agents-cannot-change-own-identity","agents-cannot-change-own-authority","unknown-identities-fail-closed","quarantine-state-remains-external","runtime-version-and-contract-must-be-verified-against-module-manifest-before-live-admission"]}}

export {VERSION as CANONICAL_AGENT_REGISTRY_VERSION,CONTRACT_VERSION as CANONICAL_AGENT_REGISTRY_CONTRACT_VERSION,REGISTRY_ID as CANONICAL_AGENT_REGISTRY_ID,AUTHORITY as CANONICAL_AGENT_REGISTRY_AUTHORITY,CANONICAL_AGENT_REGISTRY,getCanonicalAgent,isCanonicalAgent,listCanonicalAgents,createAdmissionRegistryView,validateCanonicalRuntimeIdentity,validateRegistryIntegrity,getCanonicalAgentRegistryManifest};
export default CANONICAL_AGENT_REGISTRY;
