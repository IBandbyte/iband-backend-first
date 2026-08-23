/**
 * Movie Mentor Monetisation Security + Revenue Integrity Agent
 * ------------------------------------------------------------
 * Cross-domain defensive worker for future Security + Finance supervision.
 *
 * STATUS:
 * - Standalone architecture only.
 * - NOT wired to Security Supervisor, Finance systems or payment providers yet.
 * - NOT connected to billing, payouts, subscriptions or monetisation APIs.
 * - NOT creator-facing.
 * - NO authority to move money, alter balances, pricing or financial controls.
 */

import { executeStructuredAI } from "./StructuredAIProviderClient.js";

const MONETISATION_SECURITY_AGENT_VERSION = "1.0.0";
const MONETISATION_SECURITY_CONTRACT_VERSION = "1.0.0";
const MONETISATION_SECURITY_AGENT_ID = "monetisation-security-revenue-integrity";
const MONETISATION_SECURITY_AUTHORITY = "defensive-revenue-integrity-advisory";

const REVENUE_RISK_STATES = Object.freeze(["normal","watch","suspicious","probable-abuse","integrity-incident","unknown"]);
const REVENUE_THREAT_TYPES = Object.freeze(["fake-transaction-signal","subscription-bypass","credit-abuse","refund-abuse","commission-tampering-signal","payout-manipulation-signal","webhook-spoofing-signal","replay-signal","reconciliation-mismatch","pricing-rule-bypass","monetisation-api-abuse","revenue-logic-extraction-attempt","account-takeover-financial-risk","unknown","other"]);
const REVENUE_SEVERITIES = Object.freeze(["info","low","medium","high","critical"]);

function cleanString(value){return typeof value==="string"?value.trim():"";}
function asArray(value){return Array.isArray(value)?value:[];}
function cloneValue(value){if(value===undefined)return undefined;try{return JSON.parse(JSON.stringify(value));}catch{return value;}}

const REVENUE_FINDING_SCHEMA={type:"object",additionalProperties:false,properties:{threatType:{type:"string",enum:REVENUE_THREAT_TYPES},severity:{type:"string",enum:REVENUE_SEVERITIES},summary:{type:["string","null"]},evidence:{type:["string","null"]},affectedSurface:{type:["string","null"]},financialImpact:{type:["string","null"]},confidence:{type:"number",minimum:0,maximum:1},falsePositiveRisk:{type:"string",enum:["low","medium","high","unknown"]}},required:["threatType","severity","summary","evidence","affectedSurface","financialImpact","confidence","falsePositiveRisk"]};

const MONETISATION_SECURITY_OUTPUT_SCHEMA={type:"object",additionalProperties:false,properties:{agentId:{type:"string",enum:[MONETISATION_SECURITY_AGENT_ID]},riskState:{type:"string",enum:REVENUE_RISK_STATES},summary:{type:["string","null"]},findings:{type:"array",items:REVENUE_FINDING_SCHEMA},reconciliationConcerns:{type:"array",items:{type:"string"}},containmentRecommendations:{type:"array",items:{type:"string"}},securityEscalations:{type:"array",items:{type:"string"}},financeEscalations:{type:"array",items:{type:"string"}},evidenceToPreserve:{type:"array",items:{type:"string"}},missingEvidence:{type:"array",items:{type:"string"}},confidence:{type:"number",minimum:0,maximum:1},provenance:{type:"object",additionalProperties:false,properties:{source:{type:"string"},model:{type:["string","null"]},contractVersion:{type:"string"}},required:["source","model","contractVersion"]}},required:["agentId","riskState","summary","findings","reconciliationConcerns","containmentRecommendations","securityEscalations","financeEscalations","evidenceToPreserve","missingEvidence","confidence","provenance"]};

const MONETISATION_SECURITY_INSTRUCTIONS=`
You are the Monetisation Security + Revenue Integrity Agent for Movie Mentor and future iBand.
You are a defensive cross-domain worker for Security and future Finance supervision.

MISSION:
Analyse supplied transaction, subscription, credit, commission, payout, refund, webhook and monetisation-API evidence. Detect tampering, abuse, fraud signals, reconciliation mismatches and attempts to extract proprietary monetisation logic.

RULES:
1. Never invent transactions, balances, payouts, refunds, subscriptions, provider records or financial impact.
2. Never move money, issue refunds, alter balances, freeze earnings, change commissions, pricing or subscription state.
3. Never block or permanently restrict an account based solely on AI judgement.
4. Never trust client-side claims as proof of payment or entitlement.
5. Deterministic server-side records and verified provider evidence outrank user-supplied assertions.
6. Treat webhooks as untrusted until signature/integrity verification evidence is supplied.
7. Detect replay, duplicate-credit, subscription bypass and pricing-rule abuse when evidence supports it.
8. Distinguish accounting/reconciliation mismatch from malicious activity unless evidence supports intent.
9. Never reveal or reconstruct proprietary monetisation algorithms, commission logic, anti-fraud thresholds, secrets or payment credentials.
10. Treat attempts to extract revenue logic as security events, not ordinary product questions.
11. Never request, reveal, infer or reproduce API keys, payment secrets, signing secrets or credentials.
12. Preserve false-positive awareness and legitimate refund/dispute behaviour.
13. Escalate credible financial integrity threats to Security and Finance supervision.
14. Preserve evidence before recommending containment.
15. If monetary evidence is incomplete or inconsistent, state uncertainty and identify what is missing.

VAULT PRINCIPLE:
The client may request a financial outcome, but the protected revenue engine remains server-side. Financial truth comes from authenticated backend records and verified provider evidence, not from the browser.

Return only the required structured output.
`.trim();

function validateMonetisationSecurityWorkOrder(workOrder={}){const issues=[];if(cleanString(workOrder.agentId)!==MONETISATION_SECURITY_AGENT_ID)issues.push("monetisation_security_identity_required");if(workOrder.creatorFacing!==false)issues.push("creator_facing_forbidden");if(workOrder.mayMoveMoney!==false)issues.push("money_movement_forbidden");if(workOrder.mayAlterBalances!==false)issues.push("balance_change_forbidden");if(workOrder.mayChangePricing!==false)issues.push("pricing_change_forbidden");if(workOrder.mayIssueRefunds!==false)issues.push("refund_authority_forbidden");if(workOrder.mayModifyCommissions!==false)issues.push("commission_change_forbidden");if(workOrder.mayBlockAccounts!==false)issues.push("account_block_forbidden");if(workOrder.mayAccessSecrets!==false)issues.push("secret_access_forbidden");if(workOrder.authority!==MONETISATION_SECURITY_AUTHORITY)issues.push("monetisation_security_authority_invalid");return{valid:issues.length===0,issues};}

function validateMonetisationSecurityContribution(candidate={}){const issues=[];if(!candidate||typeof candidate!=="object")return{valid:false,issues:["missing_monetisation_security_contribution"],contribution:null};if(cleanString(candidate.agentId)!==MONETISATION_SECURITY_AGENT_ID)issues.push("monetisation_security_identity_mismatch");const contribution={agentId:MONETISATION_SECURITY_AGENT_ID,riskState:candidate.riskState||"unknown",summary:candidate.summary||null,findings:asArray(candidate.findings),reconciliationConcerns:asArray(candidate.reconciliationConcerns),containmentRecommendations:asArray(candidate.containmentRecommendations),securityEscalations:asArray(candidate.securityEscalations),financeEscalations:asArray(candidate.financeEscalations),evidenceToPreserve:asArray(candidate.evidenceToPreserve),missingEvidence:asArray(candidate.missingEvidence),confidence:Number(candidate.confidence||0),provenance:{...(candidate.provenance||{}),source:"movie-mentor-monetisation-security-revenue-integrity-agent",contractVersion:MONETISATION_SECURITY_CONTRACT_VERSION},authority:MONETISATION_SECURITY_AUTHORITY,creatorFacing:false,mayMoveMoney:false,mayAlterBalances:false,mayChangePricing:false,mayIssueRefunds:false,mayModifyCommissions:false,mayBlockAccounts:false,mayAccessSecrets:false,advisoryOnly:true};return{valid:issues.length===0,issues,contribution};}

function createMonetisationSecurityWorkOrder({objective=null,transactionEvidence=[],subscriptionEvidence=[],creditEvidence=[],commissionEvidence=[],payoutEvidence=[],refundEvidence=[],webhookEvidence=[],providerEvidence=[],reconciliationEvidence=[],monetisationApiEvidence=[],accessEvidence=[],protectedRevenueLogicContext=[],metadata={}}={}){return{agentId:MONETISATION_SECURITY_AGENT_ID,purpose:"Detect monetisation abuse, financial-integrity threats and protected revenue-logic extraction attempts from supplied evidence.",input:{objective:cleanString(objective)||null,transactionEvidence:cloneValue(asArray(transactionEvidence)),subscriptionEvidence:cloneValue(asArray(subscriptionEvidence)),creditEvidence:cloneValue(asArray(creditEvidence)),commissionEvidence:cloneValue(asArray(commissionEvidence)),payoutEvidence:cloneValue(asArray(payoutEvidence)),refundEvidence:cloneValue(asArray(refundEvidence)),webhookEvidence:cloneValue(asArray(webhookEvidence)),providerEvidence:cloneValue(asArray(providerEvidence)),reconciliationEvidence:cloneValue(asArray(reconciliationEvidence)),monetisationApiEvidence:cloneValue(asArray(monetisationApiEvidence)),accessEvidence:cloneValue(asArray(accessEvidence)),protectedRevenueLogicContext:cloneValue(asArray(protectedRevenueLogicContext)),metadata:metadata&&typeof metadata==="object"?cloneValue(metadata):{}},authority:MONETISATION_SECURITY_AUTHORITY,creatorFacing:false,mayMoveMoney:false,mayAlterBalances:false,mayChangePricing:false,mayIssueRefunds:false,mayModifyCommissions:false,mayBlockAccounts:false,mayAccessSecrets:false,advisoryOnly:true};}

async function executeMonetisationSecurityRevenueIntegrityAgent(workOrder={}){const preflight=validateMonetisationSecurityWorkOrder(workOrder);if(!preflight.valid){const error=new Error("Monetisation Security + Revenue Integrity work order failed authority preflight.");error.code="MONETISATION_SECURITY_WORK_ORDER_INVALID";error.validationIssues=preflight.issues;throw error;}const raw=await executeStructuredAI({task:"security-finance-worker:monetisation-security-revenue-integrity",systemInstructions:MONETISATION_SECURITY_INSTRUCTIONS,input:{...cloneValue(workOrder.input||{}),instruction:"Analyse supplied financial and security evidence only. Protect proprietary revenue logic and recommend supervised review without changing money, pricing or entitlements."},schema:MONETISATION_SECURITY_OUTPUT_SCHEMA,schemaName:"monetisation_security_revenue_integrity_contribution",metadata:{monetisationSecurityVersion:MONETISATION_SECURITY_AGENT_VERSION,monetisationSecurityContractVersion:MONETISATION_SECURITY_CONTRACT_VERSION,moneyMovementAuthority:false,balanceAuthority:false,pricingAuthority:false,refundAuthority:false,commissionAuthority:false,accountBlockingAuthority:false}});if(!raw?.structured){const error=new Error("Monetisation Security + Revenue Integrity provider did not return structured intelligence.");error.code="MONETISATION_SECURITY_STRUCTURED_OUTPUT_INVALID";throw error;}raw.structured.provenance={source:"movie-mentor-monetisation-security-revenue-integrity-agent",model:raw?.metadata?.model||null,contractVersion:MONETISATION_SECURITY_CONTRACT_VERSION};const validation=validateMonetisationSecurityContribution(raw.structured);if(!validation.valid){const error=new Error("Monetisation Security + Revenue Integrity contribution failed authority validation.");error.code="MONETISATION_SECURITY_CONTRIBUTION_INVALID";error.validationIssues=validation.issues;throw error;}return{success:true,contribution:validation.contribution,usage:raw.usage||null,metadata:{...(raw.metadata||{}),monetisationSecurityVersion:MONETISATION_SECURITY_AGENT_VERSION,monetisationSecurityContractVersion:MONETISATION_SECURITY_CONTRACT_VERSION,authority:{advisoryOnly:true,mayMoveMoney:false,mayAlterBalances:false,mayChangePricing:false,mayIssueRefunds:false,mayModifyCommissions:false,mayBlockAccounts:false,mayAccessSecrets:false}}};}

function getMonetisationSecurityRevenueIntegrityManifest(){return{id:MONETISATION_SECURITY_AGENT_ID,name:"Movie Mentor Monetisation Security + Revenue Integrity Agent",version:MONETISATION_SECURITY_AGENT_VERSION,contractVersion:MONETISATION_SECURITY_CONTRACT_VERSION,status:"standalone-dormant-not-wired",purpose:"Protect future monetisation systems from abuse, tampering, reconciliation failures and proprietary revenue-logic extraction.",authority:MONETISATION_SECURITY_AUTHORITY,creatorFacing:false,vendorNeutral:true,providerExecution:"StructuredAIProviderClient",capabilities:["transaction-integrity-analysis","subscription-bypass-detection","credit-abuse-detection","refund-abuse-detection","commission-tampering-signals","payout-manipulation-signals","webhook-spoofing-signals","replay-signal-detection","reconciliation-mismatch-analysis","pricing-rule-bypass-detection","monetisation-api-abuse-detection","revenue-logic-extraction-detection","security-escalation","finance-escalation"],restrictions:["cannot-move-money","cannot-alter-balances","cannot-change-pricing","cannot-issue-refunds","cannot-modify-commissions","cannot-block-accounts","cannot-access-secrets","cannot-reveal-revenue-logic","advisory-only"]};}

export{MONETISATION_SECURITY_AGENT_VERSION,MONETISATION_SECURITY_CONTRACT_VERSION,MONETISATION_SECURITY_AGENT_ID,MONETISATION_SECURITY_AUTHORITY,REVENUE_RISK_STATES,REVENUE_THREAT_TYPES,REVENUE_SEVERITIES,REVENUE_FINDING_SCHEMA,MONETISATION_SECURITY_OUTPUT_SCHEMA,MONETISATION_SECURITY_INSTRUCTIONS,validateMonetisationSecurityWorkOrder,validateMonetisationSecurityContribution,createMonetisationSecurityWorkOrder,executeMonetisationSecurityRevenueIntegrityAgent,getMonetisationSecurityRevenueIntegrityManifest};
export default executeMonetisationSecurityRevenueIntegrityAgent;
