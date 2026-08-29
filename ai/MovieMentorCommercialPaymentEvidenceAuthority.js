import crypto from "crypto";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.commercial-payment-evidence-authority";

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; Object.assign(error, extras); throw error; }
function digest(value) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function createMovieMentorCommercialPaymentEvidenceAuthority({ verifyDelivery, normalizeEvent, resolvePurchaseIntent, resolveCommercialPolicy } = {}) {
  if (typeof verifyDelivery !== "function" || typeof normalizeEvent !== "function" || typeof resolvePurchaseIntent !== "function" || typeof resolveCommercialPolicy !== "function") {
    fail("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_AUTHORITY_REQUIRED", "Commercial evidence authority requires verifier, normalizer, durable purchase-intent resolver and server-owned commercial policy.");
  }

  async function verifyCommercialDelivery({ delivery = null } = {}) {
    const verified = await verifyDelivery({ delivery });
    if (verified?.verified !== true) fail("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_DELIVERY_UNVERIFIED", "Provider delivery authenticity could not be verified.");

    const event = await normalizeEvent({ verifiedDelivery: verified });
    const eventId = text(event?.eventId), provider = text(event?.provider), eventKind = text(event?.eventKind), commercialIntentId = text(event?.commercialIntentId);
    if (!eventId || !provider || !eventKind || !commercialIntentId) fail("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_EVENT_INVALID", "Verified provider event is incomplete.");
    if (event?.commerciallyFinal !== true) fail("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_NOT_FINAL", "Provider event does not prove commercially final payment.");

    const intent = await resolvePurchaseIntent({ commercialIntentId });
    if (!intent || text(intent.commercialIntentId) !== commercialIntentId || !text(intent.principalId) || !text(intent.packageId)) {
      fail("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_INTENT_NOT_FOUND", "No durable server-created purchase intent binds this payment to a creator.");
    }

    const policy = await resolveCommercialPolicy({ packageId: text(intent.packageId), provider });
    if (!policy || text(policy.packageId) !== text(intent.packageId) || text(policy.provider) !== provider || !Number.isSafeInteger(policy.units) || policy.units <= 0) {
      fail("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_POLICY_INVALID", "Server-owned commercial policy does not authorize this payment product.");
    }

    const expectedProduct = text(policy.providerProductId), expectedCurrency = text(policy.currency).toUpperCase(), actualProduct = text(event.providerProductId), actualCurrency = text(event.currency).toUpperCase();
    if (!expectedProduct || actualProduct !== expectedProduct) fail("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_PRODUCT_MISMATCH", "Provider product does not match server-owned commercial policy.");
    if (!Number.isSafeInteger(policy.amountMinor) || policy.amountMinor < 0 || event.amountMinor !== policy.amountMinor) fail("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_AMOUNT_MISMATCH", "Provider amount does not match server-owned commercial policy.");
    if (!expectedCurrency || actualCurrency !== expectedCurrency) fail("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_CURRENCY_MISMATCH", "Provider currency does not match server-owned commercial policy.");
    if (text(event.environment) !== text(policy.environment)) fail("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_ENVIRONMENT_MISMATCH", "Provider environment does not match commercial policy.");
    if (text(event.commercialIntentId) !== text(intent.commercialIntentId)) fail("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_PRINCIPAL_BINDING_INVALID", "Payment is not bound to the durable purchase intent.");

    const canonical = Object.freeze({ provider, eventId, eventKind, commercialIntentId, principalId: text(intent.principalId), packageId: text(intent.packageId), providerProductId: actualProduct, amountMinor: event.amountMinor, currency: actualCurrency, environment: text(event.environment), units: policy.units });
    return Object.freeze({ verified: true, evidenceId: eventId, evidenceSource: provider, evidenceKind: eventKind, principalId: canonical.principalId, units: policy.units, commercialReference: commercialIntentId, evidenceDigest: digest(canonical), verifiedAt: new Date().toISOString(), packageId: canonical.packageId });
  }

  return Object.freeze({ verifyCommercialDelivery });
}

export { VERSION as MOVIE_MENTOR_COMMERCIAL_PAYMENT_EVIDENCE_AUTHORITY_VERSION, DOMAIN as MOVIE_MENTOR_COMMERCIAL_PAYMENT_EVIDENCE_AUTHORITY_DOMAIN, createMovieMentorCommercialPaymentEvidenceAuthority };
export default createMovieMentorCommercialPaymentEvidenceAuthority;
