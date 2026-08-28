import {
  createMovieMentorJourneyRecoveryActivationLeaseAuthority,
} from "./MovieMentorJourneyRecoveryActivationLeaseAuthority.js";
import {
  createMovieMentorJourneyRecoveryActivationLeaseMongoStore,
  getMovieMentorJourneyRecoveryActivationLeaseMongoStoreStatus,
} from "./MovieMentorJourneyRecoveryActivationLeaseMongoStore.js";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.journey-recovery-activation-lease-composition";

function freeze(value) {
  return Object.freeze(value);
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function assertStoreContract(store) {
  if (
    !store ||
    typeof store.readLease !== "function" ||
    typeof store.createLease !== "function" ||
    typeof store.replaceLease !== "function"
  ) {
    fail(
      "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_COMPOSITION_STORE_INVALID",
      "Activation lease composition requires a durable read/create/replace store contract."
    );
  }
  return store;
}

function assertAuthorityContract(authority) {
  if (
    !authority ||
    typeof authority.authorizeActivation !== "function" ||
    typeof authority.renewActivation !== "function" ||
    typeof authority.assertFence !== "function"
  ) {
    fail(
      "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_COMPOSITION_AUTHORITY_INVALID",
      "Activation lease composition requires the certified authorize/renew/assert authority contract."
    );
  }
  return authority;
}

/**
 * 3C.5E.4G.2 — Durable Lease Authority Composition
 *
 * This boundary composes the certified Mongo durability layer with the certified
 * activation lease authority. It deliberately does not import server.js, mount
 * Express routes, or infer boot authority.
 *
 * Constitutional law:
 *   Mongo Store -> Lease Authority -> Composition Boundary.
 *   Composition first. Boot later.
 *   Missing durable configuration is not authority to degrade to process memory.
 */
function createMovieMentorJourneyRecoveryActivationLeaseComposition({
  store = null,
  createStore = createMovieMentorJourneyRecoveryActivationLeaseMongoStore,
  getStoreStatus = getMovieMentorJourneyRecoveryActivationLeaseMongoStoreStatus,
  createAuthority = createMovieMentorJourneyRecoveryActivationLeaseAuthority,
  storeOptions = undefined,
  authorityOptions = undefined,
} = {}) {
  if (typeof createAuthority !== "function") {
    fail(
      "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_COMPOSITION_AUTHORITY_FACTORY_REQUIRED",
      "Activation lease composition requires the certified authority factory."
    );
  }

  let durableStore = store;
  let source = "injected-store";
  let storeStatus = null;

  if (!durableStore) {
    if (typeof createStore !== "function" || typeof getStoreStatus !== "function") {
      fail(
        "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_COMPOSITION_STORE_FACTORY_REQUIRED",
        "Activation lease composition requires the certified Mongo store factory and status inspector."
      );
    }

    storeStatus = getStoreStatus();
    if (!storeStatus?.configured) {
      fail(
        "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_COMPOSITION_NOT_CONFIGURED",
        "Durable activation lease composition requires configured Mongo durability."
      );
    }

    durableStore = createStore(storeOptions);
    source = "mongo-store";
  }

  assertStoreContract(durableStore);

  const authority = assertAuthorityContract(
    createAuthority({
      ...(authorityOptions || {}),
      readLease: durableStore.readLease.bind(durableStore),
      createLease: durableStore.createLease.bind(durableStore),
      replaceLease: durableStore.replaceLease.bind(durableStore),
    })
  );

  const status = freeze({
    version: VERSION,
    domain: DOMAIN,
    ready: true,
    source,
    durable: true,
    store: source === "mongo-store" ? storeStatus : freeze({ configured: true, injected: true }),
    bootWired: false,
  });

  return freeze({
    authorizeActivation: authority.authorizeActivation.bind(authority),
    renewActivation: authority.renewActivation.bind(authority),
    assertFence: authority.assertFence.bind(authority),
    getStatus: () => status,
  });
}

function getMovieMentorJourneyRecoveryActivationLeaseCompositionStatus() {
  const store = getMovieMentorJourneyRecoveryActivationLeaseMongoStoreStatus();
  return freeze({
    version: VERSION,
    domain: DOMAIN,
    ready: Boolean(store?.configured),
    source: "mongo-store",
    durable: true,
    store,
    bootWired: false,
  });
}

export {
  VERSION as MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_COMPOSITION_VERSION,
  DOMAIN as MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_COMPOSITION_DOMAIN,
  createMovieMentorJourneyRecoveryActivationLeaseComposition,
  getMovieMentorJourneyRecoveryActivationLeaseCompositionStatus,
};

export default createMovieMentorJourneyRecoveryActivationLeaseComposition;
