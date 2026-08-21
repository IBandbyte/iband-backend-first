import assert from "node:assert/strict";

import {
  buildSemanticInput,
  normalizeCreatorConfirmedContext,
  validateIntelligence,
} from "../ai/MovieMentorSemanticInterpreter.js";

function baseCandidate(overrides = {}) {
  return {
    understoodContext: [],
    provisionalContext: [],
    unresolvedContext: [],
    clarificationNeeded: [],
    readyToAdvance: false,
    recommendedStageId: "story-direction",
    recommendedTaskId: null,
    nextAction: null,
    resumeNote: null,
    ...overrides,
  };
}

function creatorItem(key, value, source = "creator-explicit") {
  return {
    key,
    value,
    evidence: value,
    confidenceSource: source,
  };
}

function provisionalItem(key, value) {
  return {
    key,
    value,
    evidence: "model inference",
    confidenceSource: "model-provisional",
  };
}

function runClearCreatorLanguage() {
  const result = validateIntelligence(
    baseCandidate({
      understoodContext: [
        creatorItem("movie.idea.protagonist", "retired astronaut"),
      ],
      readyToAdvance: true,
    })
  );

  assert.equal(result.valid, true);
  assert.equal(result.intelligence.readyToAdvance, true);
}

function runUkSlangAsCreatorExplicitMeaning() {
  const result = validateIntelligence(
    baseCandidate({
      understoodContext: [
        creatorItem("movie.idea.character-state", "bare vexed"),
      ],
      provisionalContext: [
        provisionalItem("movie.idea.tone", "urban tension"),
      ],
      readyToAdvance: true,
    })
  );

  assert.equal(result.valid, true);
  assert.equal(
    result.intelligence.understoodContext[0].value,
    "bare vexed"
  );
  assert.equal(
    result.intelligence.provisionalContext[0].confidenceSource,
    "model-provisional"
  );
}

function runInventedTerminologyRequiresClarification() {
  const result = validateIntelligence(
    baseCandidate({
      clarificationNeeded: [
        {
          key: "movie.idea.expression.glorp-coded",
          expression: "glorp-coded",
          question: "What does ‘glorp-coded’ mean to you here?",
          reason: "The term is unfamiliar and materially affects the scene direction.",
          material: true,
        },
      ],
      readyToAdvance: true,
    })
  );

  assert.equal(result.valid, true);
  assert.equal(result.intelligence.readyToAdvance, false);
  assert.ok(
    result.safetyCorrections.includes(
      "material_clarification_forced_ready_to_advance_false"
    )
  );
}

function runAmbiguousRelationshipBlocksAdvance() {
  const result = validateIntelligence(
    baseCandidate({
      unresolvedContext: [
        provisionalItem("movie.character.relationship", "possibly siblings"),
      ],
      readyToAdvance: true,
    })
  );

  assert.equal(result.valid, true);
  assert.equal(result.intelligence.readyToAdvance, false);
  assert.ok(
    result.safetyCorrections.includes(
      "unresolved_context_forced_ready_to_advance_false"
    )
  );
}

function runCreatorCorrectionSupersedesPriorMeaning() {
  const creatorConfirmedContext = [
    {
      key: "movie.character.relationship",
      value: "best friends",
      authority: "creator",
    },
  ];

  const result = validateIntelligence(
    baseCandidate({
      understoodContext: [
        creatorItem("movie.character.relationship", "brother and sister"),
      ],
      readyToAdvance: true,
    }),
    { creatorConfirmedContext }
  );

  assert.equal(result.valid, true);
  assert.equal(result.intelligence.readyToAdvance, true);
  assert.ok(
    result.safetyCorrections.includes(
      "current_creator_correction_supersedes_prior:movie.character.relationship"
    )
  );
}

function runModelInferenceCannotOverrideCreatorTruth() {
  const creatorConfirmedContext = [
    {
      key: "movie.idea.ending",
      value: "hopeful",
      authority: "creator",
    },
  ];

  const result = validateIntelligence(
    baseCandidate({
      provisionalContext: [
        provisionalItem("movie.idea.ending", "tragic"),
      ],
      readyToAdvance: true,
    }),
    { creatorConfirmedContext }
  );

  assert.equal(result.valid, true);
  assert.equal(result.intelligence.provisionalContext.length, 0);
  assert.ok(
    result.safetyCorrections.includes(
      "removed_provisional_conflict_with_creator_truth:movie.idea.ending"
    )
  );
}

function runContradictoryCreatorConfirmedOutputFailsValidation() {
  const creatorConfirmedContext = [
    {
      key: "movie.idea.setting",
      value: "Liverpool",
      authority: "creator",
    },
  ];

  const result = validateIntelligence(
    baseCandidate({
      understoodContext: [
        creatorItem(
          "movie.idea.setting",
          "London",
          "creator-confirmed"
        ),
      ],
      readyToAdvance: true,
    }),
    { creatorConfirmedContext }
  );

  assert.equal(result.valid, false);
  assert.equal(result.intelligence.readyToAdvance, false);
  assert.ok(
    result.fatalIssues.includes(
      "creator_confirmed_conflict:movie.idea.setting"
    )
  );
}

function runProvisionalInferenceCannotBecomeCreatorTruth() {
  const result = validateIntelligence(
    baseCandidate({
      understoodContext: [
        provisionalItem("movie.idea.tone", "neo-noir"),
      ],
      readyToAdvance: true,
    })
  );

  assert.equal(result.valid, false);
  assert.equal(result.intelligence.readyToAdvance, false);
  assert.ok(
    result.fatalIssues.includes(
      "understood_context_requires_creator_authority"
    )
  );
}

function runConfirmedContextIsForwardedToSemanticInput() {
  const providerRequest = {
    input: {
      message: "Actually, they are brother and sister.",
    },
    context: {
      creatorConfirmedContext: [
        {
          key: "movie.character.relationship",
          value: "best friends",
          authority: "creator",
        },
      ],
    },
  };

  const confirmed = normalizeCreatorConfirmedContext(providerRequest);
  const semanticInput = buildSemanticInput(providerRequest);

  assert.equal(confirmed.length, 1);
  assert.equal(semanticInput.creatorConfirmedContext.length, 1);
  assert.equal(
    semanticInput.creatorConfirmedContext[0].value,
    "best friends"
  );
  assert.match(semanticInput.creatorMessage, /brother and sister/i);
}

const scenarios = [
  ["clear creator language may advance", runClearCreatorLanguage],
  ["UK/slang creator wording is preserved", runUkSlangAsCreatorExplicitMeaning],
  ["invented terminology creates a material clarification gate", runInventedTerminologyRequiresClarification],
  ["ambiguous relationship blocks advancement", runAmbiguousRelationshipBlocksAdvance],
  ["current creator correction supersedes prior creator meaning", runCreatorCorrectionSupersedesPriorMeaning],
  ["model inference cannot override creator truth", runModelInferenceCannotOverrideCreatorTruth],
  ["contradictory creator-confirmed output fails validation", runContradictoryCreatorConfirmedOutputFailsValidation],
  ["provisional inference cannot become creator truth", runProvisionalInferenceCannotBecomeCreatorTruth],
  ["confirmed journey truth is forwarded into semantic input", runConfirmedContextIsForwardedToSemanticInput],
];

for (const [name, run] of scenarios) {
  run();
  console.log(`✓ ${name}`);
}

console.log(
  `\nMovie Mentor semantic verification passed: ${scenarios.length}/${scenarios.length} scenarios.`
);
