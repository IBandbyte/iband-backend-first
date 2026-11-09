import { createMovieMentorCreatorStateReadAuthority } from "./MovieMentorCreatorStateReadAuthority.js";
import { createMovieMentorCreatorStateRecoveryHttpHandler } from "./MovieMentorCreatorStateRecoveryHttpHandler.js";

const VERSION = "0.1.0";
function s(value) { return typeof value === "string" ? value.trim() : ""; }
function createMovieMentorCreatorStateRecoveryProductionComposition({
  authentication, ownershipAuthority, readCreatorState,
} = {}) {
  if (authentication?.ready !== true ||
      authentication?.provider !== "clerk" ||
      authentication?.verifierAlgorithm !== "RS256" ||
      authentication?.verifierNetworkMode !== "pinned-public-key" ||
      !s(authentication.expectedIssuer) || !s(authentication.expectedAudience) ||
      typeof authentication.verifyCredential !== "function") {
    throw new TypeError("Creator-state recovery requires configured pinned-key Clerk RS256 authentication.");
  }
  const readAuthority = createMovieMentorCreatorStateReadAuthority({ ownershipAuthority, readCreatorState });
  const authenticate = async ({ authorization }) => {
    const credential = s(authorization).replace(/^Bearer\s+/i, "");
    if (!credential || credential === authorization) return { authenticated: false };
    const proof = await authentication.verifyCredential({
      credential,
      expectedIssuer: authentication.expectedIssuer,
      expectedAudience: authentication.expectedAudience,
    });
    if (proof?.verified !== true || proof.active !== true || proof.revoked !== false ||
        !s(proof.subject)) return { authenticated: false };
    return Object.freeze({ authenticated: true, principalId: proof.subject });
  };
  const handle = createMovieMentorCreatorStateRecoveryHttpHandler({ authenticate, readAuthority });
  return Object.freeze({ version: VERSION, handle });
}
export { createMovieMentorCreatorStateRecoveryProductionComposition };
export default createMovieMentorCreatorStateRecoveryProductionComposition;
