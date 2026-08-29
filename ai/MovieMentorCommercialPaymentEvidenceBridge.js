const VERSION = "1.0.0";

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }

function createMovieMentorCommercialPaymentEvidenceBridge({ evidenceAuthority = null, issuanceAuthority = null } = {}) {
  if (typeof evidenceAuthority?.verifyCommercialDelivery !== "function") fail("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_AUTHORITY_REQUIRED", "Verified commercial evidence authority is required.");
  if (typeof issuanceAuthority?.issueVerifiedEvidence !== "function") fail("MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_AUTHORITY_REQUIRED", "Sealed entitlement issuance authority is required.");

  async function processProviderDelivery({ delivery = null } = {}) {
    const evidence = await evidenceAuthority.verifyCommercialDelivery({ delivery });
    if (evidence?.verified !== true) fail("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_UNVERIFIED", "Only verified commercial evidence may reach entitlement issuance.");
    return issuanceAuthority.issueVerifiedEvidence({ evidence });
  }

  return Object.freeze({ processProviderDelivery });
}

export { VERSION as MOVIE_MENTOR_COMMERCIAL_PAYMENT_EVIDENCE_BRIDGE_VERSION, createMovieMentorCommercialPaymentEvidenceBridge };
export default createMovieMentorCommercialPaymentEvidenceBridge;
