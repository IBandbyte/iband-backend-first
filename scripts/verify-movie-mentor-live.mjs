import assert from "node:assert/strict";

const BASE_URL = (process.env.IBAND_LIVE_BACKEND_URL || "https://iband-backend-first-1.onrender.com").replace(/\/$/, "");
const HEALTH_URL = `${BASE_URL}/api/movie-mentor-semantic/health`;
const INTERPRET_URL = `${BASE_URL}/api/movie-mentor-semantic/interpret`;

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

async function getHealth() {
  const response = await fetch(HEALTH_URL, { headers: { Accept: "application/json" } });
  const body = await readJson(response);
  assert.equal(response.ok, true, `Health failed (${response.status}): ${JSON.stringify(body)}`);
  assert.equal(body?.semanticProviderConfigured, true, "Semantic provider is not configured on live backend");
  assert.equal(body?.providerName, "openai", `Unexpected provider: ${body?.providerName}`);
  assert.equal(body?.model, "gpt-5.4-mini", `Unexpected model: ${body?.model}`);
  console.log(`✓ live provider ready: ${body.providerName}/${body.model}`);
  return body;
}

async function interpret(name, creatorMessage, context = {}) {
  const response = await fetch(INTERPRET_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { message: creatorMessage },
      context,
      options: { metadata: { verificationCase: name } },
    }),
  });
  const body = await readJson(response);
  if (!response.ok) {
    const error = new Error(`${name} failed (${response.status}) ${body?.code || "UNKNOWN"}: ${body?.message || JSON.stringify(body)}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  const intelligence = body?.structured?.movieJourneyIntelligence;
  assert.ok(intelligence, `${name}: missing movieJourneyIntelligence`);
  assert.ok(Array.isArray(intelligence.understoodContext), `${name}: understoodContext missing`);
  assert.ok(Array.isArray(intelligence.provisionalContext), `${name}: provisionalContext missing`);
  assert.ok(Array.isArray(intelligence.unresolvedContext), `${name}: unresolvedContext missing`);
  assert.ok(Array.isArray(intelligence.clarificationNeeded), `${name}: clarificationNeeded missing`);
  assert.equal(typeof intelligence.readyToAdvance, "boolean", `${name}: readyToAdvance missing`);
  console.log(`✓ ${name}: structured semantic intelligence validated; advance=${intelligence.readyToAdvance}; clarifications=${intelligence.clarificationNeeded.length}; unresolved=${intelligence.unresolvedContext.length}`);
  return intelligence;
}

await getHealth();

const clear = await interpret(
  "clear-language",
  "A retired astronaut discovers that the lighthouse in her coastal town is sending messages from her missing daughter."
);
assert.equal(clear.clarificationNeeded.some((item) => item?.material), false, "clear-language unexpectedly produced material clarification");

await interpret(
  "uk-slang",
  "Make him bare vexed but still moving booky when he clocks the rival crew outside the club."
);

const invented = await interpret(
  "invented-terminology",
  "The final scene must feel glorp-coded when the beat drops."
);
assert.equal(invented.readyToAdvance, false, "invented terminology must not advance");
assert.equal(invented.clarificationNeeded.some((item) => item?.material === true), true, "invented terminology must create material clarification");

const ambiguous = await interpret(
  "material-ambiguity",
  "The killer is either Mia or Lena; I haven't decided which one. Reveal her in the final scene."
);
assert.equal(ambiguous.readyToAdvance, false, "material ambiguity must not advance");
assert.equal(
  ambiguous.unresolvedContext.length > 0 || ambiguous.clarificationNeeded.some((item) => item?.material === true),
  true,
  "material ambiguity must remain unresolved or require clarification"
);

const correction = await interpret(
  "creator-correction",
  "Actually, they're brother and sister, not best friends.",
  {
    creatorConfirmedContext: [
      {
        key: "movie.character.relationship",
        value: "best friends",
        authority: "creator",
      },
    ],
  }
);
assert.equal(
  correction.provisionalContext.some((item) => item?.key === "movie.character.relationship" && /best friends/i.test(String(item?.value || ""))),
  false,
  "creator correction must not be overridden by provisional prior meaning"
);

console.log("\nLive Movie Mentor semantic verification passed: provider readiness + 5 real-model cases.");
