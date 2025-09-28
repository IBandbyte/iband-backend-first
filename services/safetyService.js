// services/safetyService.js
// Minimal, dependency-light panic pipeline. Replace with DB/queues later.

const cases = new Map();           // caseId -> case record
const userLastPanicAt = new Map(); // userId -> timestamp (rate limit)

const ONE_MINUTE = 60_000;

function nowISO() { return new Date().toISOString(); }

function rateLimitOk(userId) {
  const last = userLastPanicAt.get(userId) || 0;
  const delta = Date.now() - last;
  if (delta < ONE_MINUTE) return false; // 1 per minute per user
  userLastPanicAt.set(userId, Date.now());
  return true;
}

function sanitize(data) {
  return {
    userId: (data.userId || 'anon').toString(),
    category: (data.category || 'unspecified').toString(),
    message: (data.message || '').toString().slice(0, 1000),
    contentId: data.contentId || null,
    liveId: data.liveId || null,
    notifyLaw: !!data.notifyLaw,
    evidenceUrls: Array.isArray(data.evidenceUrls)
      ? data.evidenceUrls.slice(0, 5)
      : []
  };
}

function inferSeverity({ category = '' }) {
  const c = String(category).toLowerCase();
  if (/exploitation|coercion|threat|violence|self-?harm|assault/.test(c)) return 'high';
  if (/harass|bully|abuse|stalk/.test(c)) return 'medium';
  return 'low';
}

/**
 * createPanicCase(data)
 * data = { userId, category, message?, contentId?, liveId?, notifyLaw?, evidenceUrls?[] }
 */
function createPanicCase(data) {
  const id = String(Date.now()) + Math.random().toString(36).slice(2, 7);
  const record = {
    id,
    status: 'open',
    severity: inferSeverity(data),
    ...sanitize(data),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    audit: [{ at: nowISO(), event: 'case_created' }]
  };
  cases.set(id, record);

  // Async side effects (stub): notify T&S queue, optional LE packet
  if (record.notifyLaw) {
    console.warn('[PANIC] LE-notify requested:', { caseId: id });
  }

  return record;
}

function ackCase(caseId, moderator) {
  const rec = cases.get(caseId);
  if (!rec) return null;
  rec.status = 'acknowledged';
  rec.updatedAt = nowISO();
  rec.audit.push({ at: nowISO(), event: 'acknowledged', by: moderator || 'system' });
  return rec;
}

function resolveCase(caseId, outcome, moderator) {
  const rec = cases.get(caseId);
  if (!rec) return null;
  rec.status = 'resolved';
  rec.outcome = outcome || 'no_action';
  rec.updatedAt = nowISO();
  rec.audit.push({ at: nowISO(), event: 'resolved', outcome: rec.outcome, by: moderator || 'system' });
  return rec;
}

function getCase(caseId) {
  return cases.get(caseId) || null;
}

function listCases({ status, limit = 50 } = {}) {
  let arr = Array.from(cases.values());
  if (status) arr = arr.filter(c => c.status === status);
  arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return arr.slice(0, limit);
}

module.exports = {
  rateLimitOk,
  createPanicCase,
  ackCase,
  resolveCase,
  getCase,
  listCases
};