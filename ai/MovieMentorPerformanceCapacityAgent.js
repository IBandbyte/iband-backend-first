/**
 * Movie Mentor Performance + Capacity Agent
 * ------------------------------------------------------------
 * Operations patrol worker for performance, throughput and capacity signals.
 *
 * STATUS:
 * - Standalone architecture only.
 * - NOT wired to Operations + Reliability Supervisor yet.
 * - NOT connected to live telemetry or infrastructure controls.
 * - NOT creator-facing.
 * - NO scaling, traffic, deployment or purchasing authority.
 */

import { executeStructuredAI } from "./StructuredAIProviderClient.js";

const PERFORMANCE_CAPACITY_AGENT_VERSION = "1.0.0";
const PERFORMANCE_CAPACITY_CONTRACT_VERSION = "1.0.0";
const PERFORMANCE_CAPACITY_AGENT_ID = "performance-capacity";
const PERFORMANCE_CAPACITY_AUTHORITY = "observational-performance-patrol-worker";

const PERFORMANCE_STATES = Object.freeze(["healthy", "watch", "degraded", "capacity-risk", "unknown"]);
const BOTTLENECK_TYPES = Object.freeze(["frontend", "api", "ai-provider", "database", "queue", "network", "cpu", "memory", "storage", "concurrency", "timeout", "cold-start", "unknown", "other"]);
const PRESSURE_LEVELS = Object.freeze(["none", "low", "medium", "high", "critical", "unknown"]);

function cleanString(value) { return typeof value === "string" ? value.trim() : ""; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function cloneValue(value) { if (value === undefined) return undefined; try { return JSON.parse(JSON.stringify(value)); } catch { return value; } }

const PERFORMANCE_FINDING_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    bottleneckType: { type: "string", enum: BOTTLENECK_TYPES },
    pressure: { type: "string", enum: PRESSURE_LEVELS },
    summary: { type: ["string", "null"] },
    evidence: { type: ["string", "null"] },
    affectedPath: { type: ["string", "null"] },
    creatorImpact: { type: ["string", "null"] },
    likelyCause: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["bottleneckType", "pressure", "summary", "evidence", "affectedPath", "creatorImpact", "likelyCause", "confidence"],
};

const CAPACITY_RECOMMENDATION_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    description: { type: ["string", "null"] },
    reason: { type: ["string", "null"] },
    target: { type: ["string", "null"] },
    recommendationType: { type: "string", enum: ["observe", "profile", "benchmark", "load-test-nonproduction", "optimise-code-review", "queue-review", "provider-review", "capacity-review", "architecture-review", "other"] },
    safeToAutomate: { type: "boolean" },
    requiresApproval: { type: "boolean" },
  },
  required: ["description", "reason", "target", "recommendationType", "safeToAutomate", "requiresApproval"],
};

const PERFORMANCE_CAPACITY_OUTPUT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    agentId: { type: "string", enum: [PERFORMANCE_CAPACITY_AGENT_ID] },
    performanceState: { type: "string", enum: PERFORMANCE_STATES },
    summary: { type: ["string", "null"] },
    findings: { type: "array", items: PERFORMANCE_FINDING_SCHEMA },
    recommendations: { type: "array", items: CAPACITY_RECOMMENDATION_SCHEMA },
    supervisorEscalations: { type: "array", items: { type: "string" } },
    engineeringEscalations: { type: "array", items: { type: "string" } },
    missingEvidence: { type: "array", items: { type: "string" } },
    capacityHeadroomObservations: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    provenance: { type: "object", additionalProperties: false, properties: { source: { type: "string" }, model: { type: ["string", "null"] }, contractVersion: { type: "string" } }, required: ["source", "model", "contractVersion"] },
  },
  required: ["agentId", "performanceState", "summary", "findings", "recommendations", "supervisorEscalations", "engineeringEscalations", "missingEvidence", "capacityHeadroomObservations", "confidence", "provenance"],
};

const PERFORMANCE_CAPACITY_INSTRUCTIONS = `
You are the Performance + Capacity patrol worker for Movie Mentor and future iBand operations.
You report to the Operations + Reliability Supervisor. You analyse supplied evidence but do not control production resources.

MISSION:
Analyse supplied latency, throughput, concurrency, queue, timeout, resource, provider and workload evidence. Detect bottlenecks and capacity pressure early enough to protect creator experience as usage grows.

RULES:
1. Never claim live monitoring unless current telemetry was supplied.
2. Never invent latency percentiles, throughput, concurrency, queue depth, resource utilisation, limits or traffic volumes.
3. Never infer capacity headroom without evidence for both current demand and relevant limits/baselines.
4. Distinguish slow AI-provider responses from slow application code when evidence supports it.
5. Distinguish cold starts, queues, network delay and compute saturation rather than collapsing all slowness into one cause.
6. Averages can hide bad tail latency; use supplied percentile evidence when available.
7. Never run or recommend uncontrolled load tests against production.
8. Load testing recommendations must target an explicitly safe non-production environment unless authorised otherwise outside this agent.
9. Never scale infrastructure, alter autoscaling, queues, traffic, timeouts, caching, provider routing or concurrency limits.
10. Never deploy, purchase capacity, change hosting plans or alter billing.
11. Never request, reveal, infer or reproduce credentials, API keys or secrets.
12. Never sacrifice creator privacy, safety, correctness or quality merely to reduce latency.
13. Recommend Engineering review for probable code/architecture bottlenecks.
14. Recommend Operations Supervisor review for capacity or infrastructure pressure.
15. If evidence is insufficient, mark uncertainty and request the missing telemetry rather than guessing.

PERFORMANCE PRINCIPLE:
Fast is valuable only when correct and reliable. Optimise the creator's experienced journey, not isolated benchmark numbers.

Return only the required structured output.
`.trim();

function validatePerformanceCapacityWorkOrder(workOrder = {}) {
  const issues = [];
  if (cleanString(workOrder.agentId) !== PERFORMANCE_CAPACITY_AGENT_ID) issues.push("performance_capacity_identity_required");
  if (workOrder.creatorFacing !== false) issues.push("creator_facing_forbidden");
  if (workOrder.mayLoadTestProduction !== false) issues.push("production_load_test_forbidden");
  if (workOrder.mayScaleInfrastructure !== false) issues.push("infrastructure_scaling_forbidden");
  if (workOrder.mayAlterTraffic !== false) issues.push("traffic_change_forbidden");
  if (workOrder.mayDeploy !== false) issues.push("deployment_forbidden");
  if (workOrder.mayPurchaseCapacity !== false) issues.push("capacity_purchase_forbidden");
  if (workOrder.mayAccessSecrets !== false) issues.push("secret_access_forbidden");
  if (workOrder.authority !== PERFORMANCE_CAPACITY_AUTHORITY) issues.push("performance_capacity_authority_invalid");
  return { valid: issues.length === 0, issues };
}

function validatePerformanceCapacityContribution(candidate = {}) {
  const issues = [];
  if (!candidate || typeof candidate !== "object") return { valid: false, issues: ["missing_performance_capacity_contribution"], contribution: null };
  if (cleanString(candidate.agentId) !== PERFORMANCE_CAPACITY_AGENT_ID) issues.push("performance_capacity_identity_mismatch");
  for (const recommendation of asArray(candidate.recommendations)) {
    if (["capacity-review", "provider-review", "architecture-review", "optimise-code-review", "queue-review"].includes(recommendation?.recommendationType) && recommendation?.requiresApproval !== true) issues.push("material_performance_recommendation_requires_approval");
    if (recommendation?.safeToAutomate === true && !["observe", "profile", "benchmark"].includes(recommendation?.recommendationType)) issues.push("automatic_performance_action_outside_safe_scope");
  }
  const contribution = {
    agentId: PERFORMANCE_CAPACITY_AGENT_ID,
    performanceState: candidate.performanceState || "unknown",
    summary: candidate.summary || null,
    findings: asArray(candidate.findings),
    recommendations: asArray(candidate.recommendations),
    supervisorEscalations: asArray(candidate.supervisorEscalations),
    engineeringEscalations: asArray(candidate.engineeringEscalations),
    missingEvidence: asArray(candidate.missingEvidence),
    capacityHeadroomObservations: asArray(candidate.capacityHeadroomObservations),
    confidence: Number(candidate.confidence || 0),
    provenance: { ...(candidate.provenance || {}), source: "movie-mentor-performance-capacity-agent", contractVersion: PERFORMANCE_CAPACITY_CONTRACT_VERSION },
    authority: PERFORMANCE_CAPACITY_AUTHORITY,
    creatorFacing: false,
    mayLoadTestProduction: false,
    mayScaleInfrastructure: false,
    mayAlterTraffic: false,
    mayDeploy: false,
    mayPurchaseCapacity: false,
    mayAccessSecrets: false,
    observationalOnly: true,
  };
  return { valid: issues.length === 0, issues, contribution };
}

function createPerformanceCapacityWorkOrder({ objective = null, observationWindow = null, latencyEvidence = [], throughputEvidence = [], concurrencyEvidence = [], queueEvidence = [], timeoutEvidence = [], resourceEvidence = [], providerEvidence = [], workloadEvidence = [], baselineEvidence = [], limitEvidence = [], architectureContext = {}, metadata = {} } = {}) {
  return {
    agentId: PERFORMANCE_CAPACITY_AGENT_ID,
    purpose: "Detect performance bottlenecks and capacity pressure from supplied telemetry without autonomous production control.",
    input: {
      objective: cleanString(objective) || null,
      observationWindow: cloneValue(observationWindow),
      latencyEvidence: cloneValue(asArray(latencyEvidence)),
      throughputEvidence: cloneValue(asArray(throughputEvidence)),
      concurrencyEvidence: cloneValue(asArray(concurrencyEvidence)),
      queueEvidence: cloneValue(asArray(queueEvidence)),
      timeoutEvidence: cloneValue(asArray(timeoutEvidence)),
      resourceEvidence: cloneValue(asArray(resourceEvidence)),
      providerEvidence: cloneValue(asArray(providerEvidence)),
      workloadEvidence: cloneValue(asArray(workloadEvidence)),
      baselineEvidence: cloneValue(asArray(baselineEvidence)),
      limitEvidence: cloneValue(asArray(limitEvidence)),
      architectureContext: cloneValue(architectureContext),
      metadata: metadata && typeof metadata === "object" ? cloneValue(metadata) : {},
    },
    authority: PERFORMANCE_CAPACITY_AUTHORITY,
    creatorFacing: false,
    mayLoadTestProduction: false,
    mayScaleInfrastructure: false,
    mayAlterTraffic: false,
    mayDeploy: false,
    mayPurchaseCapacity: false,
    mayAccessSecrets: false,
    observationalOnly: true,
  };
}

async function executePerformanceCapacityAgent(workOrder = {}) {
  const preflight = validatePerformanceCapacityWorkOrder(workOrder);
  if (!preflight.valid) {
    const error = new Error("Performance + Capacity work order failed authority preflight.");
    error.code = "PERFORMANCE_CAPACITY_WORK_ORDER_INVALID";
    error.validationIssues = preflight.issues;
    throw error;
  }

  const raw = await executeStructuredAI({
    task: "operations-worker:performance-capacity",
    systemInstructions: PERFORMANCE_CAPACITY_INSTRUCTIONS,
    input: {
      objective: workOrder?.input?.objective || null,
      observationWindow: cloneValue(workOrder?.input?.observationWindow || null),
      latencyEvidence: cloneValue(workOrder?.input?.latencyEvidence || []),
      throughputEvidence: cloneValue(workOrder?.input?.throughputEvidence || []),
      concurrencyEvidence: cloneValue(workOrder?.input?.concurrencyEvidence || []),
      queueEvidence: cloneValue(workOrder?.input?.queueEvidence || []),
      timeoutEvidence: cloneValue(workOrder?.input?.timeoutEvidence || []),
      resourceEvidence: cloneValue(workOrder?.input?.resourceEvidence || []),
      providerEvidence: cloneValue(workOrder?.input?.providerEvidence || []),
      workloadEvidence: cloneValue(workOrder?.input?.workloadEvidence || []),
      baselineEvidence: cloneValue(workOrder?.input?.baselineEvidence || []),
      limitEvidence: cloneValue(workOrder?.input?.limitEvidence || []),
      architectureContext: cloneValue(workOrder?.input?.architectureContext || {}),
      instruction: "Analyse performance and capacity only from supplied evidence. Protect creator experience and recommend supervised investigation rather than autonomous scaling or traffic changes.",
    },
    schema: PERFORMANCE_CAPACITY_OUTPUT_SCHEMA,
    schemaName: "performance_capacity_contribution",
    metadata: {
      performanceCapacityVersion: PERFORMANCE_CAPACITY_AGENT_VERSION,
      performanceCapacityContractVersion: PERFORMANCE_CAPACITY_CONTRACT_VERSION,
      productionLoadTestAuthority: false,
      infrastructureScalingAuthority: false,
      trafficChangeAuthority: false,
      deploymentAuthority: false,
      purchaseAuthority: false,
    },
  });

  if (!raw?.structured) {
    const error = new Error("Performance + Capacity provider did not return structured intelligence.");
    error.code = "PERFORMANCE_CAPACITY_STRUCTURED_OUTPUT_INVALID";
    throw error;
  }

  raw.structured.provenance = { source: "movie-mentor-performance-capacity-agent", model: raw?.metadata?.model || null, contractVersion: PERFORMANCE_CAPACITY_CONTRACT_VERSION };
  const validation = validatePerformanceCapacityContribution(raw.structured);
  if (!validation.valid) {
    const error = new Error("Performance + Capacity contribution failed authority validation.");
    error.code = "PERFORMANCE_CAPACITY_CONTRIBUTION_INVALID";
    error.validationIssues = validation.issues;
    throw error;
  }

  return {
    success: true,
    contribution: validation.contribution,
    usage: raw.usage || null,
    metadata: {
      ...(raw.metadata || {}),
      performanceCapacityVersion: PERFORMANCE_CAPACITY_AGENT_VERSION,
      performanceCapacityContractVersion: PERFORMANCE_CAPACITY_CONTRACT_VERSION,
      authority: { observationalOnly: true, mayLoadTestProduction: false, mayScaleInfrastructure: false, mayAlterTraffic: false, mayDeploy: false, mayPurchaseCapacity: false, mayAccessSecrets: false },
    },
  };
}

function getPerformanceCapacityManifest() {
  return {
    id: PERFORMANCE_CAPACITY_AGENT_ID,
    name: "Movie Mentor Performance + Capacity Agent",
    version: PERFORMANCE_CAPACITY_AGENT_VERSION,
    contractVersion: PERFORMANCE_CAPACITY_CONTRACT_VERSION,
    status: "standalone-dormant-not-wired",
    purpose: "Protect future creator experience by detecting latency bottlenecks, queue pressure and capacity risk before scale becomes failure.",
    authority: PERFORMANCE_CAPACITY_AUTHORITY,
    creatorFacing: false,
    vendorNeutral: true,
    providerExecution: "StructuredAIProviderClient",
    capabilities: ["latency-analysis", "tail-latency-observation", "throughput-analysis", "concurrency-analysis", "queue-pressure-analysis", "timeout-analysis", "resource-pressure-analysis", "provider-latency-classification", "bottleneck-classification", "capacity-headroom-observation", "performance-escalation", "nonproduction-load-test-planning"],
    restrictions: ["cannot-load-test-production", "cannot-scale-infrastructure", "cannot-alter-traffic", "cannot-deploy", "cannot-purchase-capacity", "cannot-access-secrets", "cannot-invent-performance-telemetry", "observational-only"],
  };
}

export {
  PERFORMANCE_CAPACITY_AGENT_VERSION,
  PERFORMANCE_CAPACITY_CONTRACT_VERSION,
  PERFORMANCE_CAPACITY_AGENT_ID,
  PERFORMANCE_CAPACITY_AUTHORITY,
  PERFORMANCE_STATES,
  BOTTLENECK_TYPES,
  PRESSURE_LEVELS,
  PERFORMANCE_FINDING_SCHEMA,
  CAPACITY_RECOMMENDATION_SCHEMA,
  PERFORMANCE_CAPACITY_OUTPUT_SCHEMA,
  PERFORMANCE_CAPACITY_INSTRUCTIONS,
  validatePerformanceCapacityWorkOrder,
  validatePerformanceCapacityContribution,
  createPerformanceCapacityWorkOrder,
  executePerformanceCapacityAgent,
  getPerformanceCapacityManifest,
};

export default executePerformanceCapacityAgent;
