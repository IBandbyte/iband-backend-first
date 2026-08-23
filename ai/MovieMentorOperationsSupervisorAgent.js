/**
 * DEPRECATED COMPATIBILITY BRIDGE
 * ------------------------------------------------------------
 * The canonical Operations Supervisor now lives in:
 * ./MovieMentorOperationsSupervisor.js
 *
 * This file intentionally contains no independent supervisor identity,
 * authority contract, AI prompt or execution implementation. It exists only
 * to preserve legacy imports while the dormant architecture is migrated.
 */

import executeOperationsSupervisor, {
  OPERATIONS_SUPERVISOR_VERSION,
  OPERATIONS_SUPERVISOR_CONTRACT_VERSION,
  OPERATIONS_SUPERVISOR_ID,
  OPERATIONS_SUPERVISOR_AUTHORITY,
  OPERATIONS_SUPERVISOR_OUTPUT_SCHEMA,
  OPERATIONS_SUPERVISOR_INSTRUCTIONS,
  createOperationsSupervisorWorkOrder,
  validateOperationsSupervisorWorkOrder,
  executeOperationsSupervisor as executeCanonicalOperationsSupervisor,
  getOperationsSupervisorManifest as getCanonicalOperationsSupervisorManifest,
} from "./MovieMentorOperationsSupervisor.js";

const OPERATIONS_SUPERVISOR_AGENT_ID = OPERATIONS_SUPERVISOR_ID;

function validateOperationsSupervisorContribution(contribution = {}) {
  const valid = contribution?.supervisorId === OPERATIONS_SUPERVISOR_ID && contribution?.readOnly === true;
  return {
    valid,
    issues: valid ? [] : ["legacy_supervisor_contribution_not_canonical"],
    contribution: valid ? contribution : null,
  };
}

async function executeOperationsSupervisorAgent(workOrder = {}) {
  return executeCanonicalOperationsSupervisor(workOrder);
}

function getOperationsSupervisorManifest() {
  return {
    ...getCanonicalOperationsSupervisorManifest(),
    legacyBridge: true,
    deprecatedPath: "ai/MovieMentorOperationsSupervisorAgent.js",
    canonicalPath: "ai/MovieMentorOperationsSupervisor.js",
  };
}

export {
  OPERATIONS_SUPERVISOR_VERSION,
  OPERATIONS_SUPERVISOR_CONTRACT_VERSION,
  OPERATIONS_SUPERVISOR_AGENT_ID,
  OPERATIONS_SUPERVISOR_AUTHORITY,
  OPERATIONS_SUPERVISOR_OUTPUT_SCHEMA,
  OPERATIONS_SUPERVISOR_INSTRUCTIONS,
  validateOperationsSupervisorWorkOrder,
  validateOperationsSupervisorContribution,
  createOperationsSupervisorWorkOrder,
  executeOperationsSupervisorAgent,
  getOperationsSupervisorManifest,
};

export default executeOperationsSupervisor;
