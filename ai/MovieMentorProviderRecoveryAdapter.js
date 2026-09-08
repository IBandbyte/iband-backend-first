import {
  getStructuredAIProviderConfig,
  getStructuredAIProviderConfigurationIssues,
  transportTargetFromConfig,
} from "./StructuredAIProviderClient.js";
import {
  normalizeMovieMentorProviderTarget,
  sameMovieMentorProviderTarget,
} from "./MovieMentorProviderTargetAuthority.js";

const VERSION = "1.1.0";
const DOMAIN = "iband.movie-mentor.provider-recovery-adapter";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(code, message, extras = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extras);
  throw error;
}

function retrievalUrl(baseUrl, externalEffectId) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    fail("MOVIE_MENTOR_PROVIDER_RECOVERY_ROUTE_INVALID", "Provider recovery route is invalid.", { retryable: false });
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    fail("MOVIE_MENTOR_PROVIDER_RECOVERY_ROUTE_INVALID", "Provider recovery route must use HTTP or HTTPS.", { retryable: false });
  }
  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/${encodeURIComponent(externalEffectId)}`;
  return parsed.toString();
}

async function getJson(url, { key = "", timeoutMs = 30_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { payload = { raw }; }
    if (!response.ok) {
      const error = new Error(text(payload?.error?.message) || text(payload?.message) || `Provider recovery failed (${response.status}).`);
      error.code = response.status === 404
        ? "MOVIE_MENTOR_PROVIDER_RECOVERY_RESPONSE_NOT_FOUND"
        : "MOVIE_MENTOR_PROVIDER_RECOVERY_REQUEST_FAILED";
      error.status = response.status;
      error.retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
      error.data = payload;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      fail("MOVIE_MENTOR_PROVIDER_RECOVERY_TIMEOUT", "Provider recovery request timed out.", { retryable: true });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function retrieveMovieMentorProviderResponse(request = {}) {
  const method = text(request.method);
  const providerOperationId = text(request.providerOperationId || request.providerCallId);
  const externalEffectId = text(request.externalEffectId);
  const providerTarget = normalizeMovieMentorProviderTarget(request.providerTarget);
  if (method !== "retrieve-known-response-id" || !providerOperationId || !externalEffectId) {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECOVERY_REQUEST_INVALID",
      "Provider recovery adapter requires exact same-operation identity, known external response ID and recovery-only method.",
      { retryable: false },
    );
  }
  if (
    providerTarget.provider !== "openai"
    || providerTarget.adapter !== "openai-responses"
    || providerTarget.recoveryMode !== "known-response-id-retrieval"
  ) {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECOVERY_CAPABILITY_UNSUPPORTED",
      "Historical provider target does not declare known-response-ID retrieval capability.",
      { retryable: false },
    );
  }

  const config = getStructuredAIProviderConfig();
  const issues = getStructuredAIProviderConfigurationIssues(config);
  if (issues.length || config.provider !== "openai") {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECOVERY_PROVIDER_NOT_CONFIGURED",
      "Current provider configuration cannot execute the historical OpenAI response retrieval mechanism.",
      { retryable: false, configurationIssues: issues },
    );
  }

  let currentTarget = null;
  try {
    currentTarget = transportTargetFromConfig(config);
  } catch {
    currentTarget = null;
  }
  if (!currentTarget || !sameMovieMentorProviderTarget(providerTarget, currentTarget)) {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECOVERY_TRANSPORT_TARGET_AUTHORITY_INVALID",
      "Provider recovery transport no longer matches the exact historical provider target authorized for this durable operation.",
      { retryable: false, providerOperationId },
    );
  }

  const payload = await getJson(retrievalUrl(config.url, externalEffectId), {
    key: config.key,
    timeoutMs: config.timeoutMs,
  });
  if (!payload || typeof payload !== "object") {
    fail("MOVIE_MENTOR_PROVIDER_RECOVERY_RESPONSE_INVALID", "Provider recovery returned no response object.", { retryable: true });
  }
  const recoveredId = text(payload.id);
  if (!recoveredId || recoveredId !== externalEffectId) {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECOVERY_RESPONSE_ID_CONFLICT",
      "Provider recovery response does not bind the exact known historical response ID.",
      { retryable: false, expectedResponseId: externalEffectId, recoveredResponseId: recoveredId || null },
    );
  }

  return Object.freeze({
    provider: "openai",
    externalEffectId,
    providerOperationId,
    recoveryMethod: method,
    response: payload,
  });
}

export {
  VERSION as MOVIE_MENTOR_PROVIDER_RECOVERY_ADAPTER_VERSION,
  DOMAIN as MOVIE_MENTOR_PROVIDER_RECOVERY_ADAPTER_DOMAIN,
  retrieveMovieMentorProviderResponse,
};

export default retrieveMovieMentorProviderResponse;
