# ChainGuard risk model v1.0.0

This document describes the current pure JavaScript implementation in `server/src/services/risk/risk-engine.js`. The score is a prioritization aid. It does not determine legal status, establish identity, or guarantee that a wallet is safe.

## Verdicts and coverage

| Verdict | Score | Meaning |
|---|---:|---|
| `CRITICAL` | 85–100, or confirmed direct sanctions/freeze | Escalate under the applicable compliance policy. |
| `HIGH` | 65–84 | Pause interaction and review cited evidence. |
| `MEDIUM` | 35–64 | Review exposure and behavior evidence. |
| `LOW` | 0–34 with adequate coverage | No elevated known risk in the configured, current sources; not a safety guarantee. |
| `UNKNOWN` | No usable evidence and coverage is incomplete, stale, or unavailable | Obtain broader or fresher data before drawing a conclusion. Score is `null`. |

Adequate coverage requires `coverage.complete === true`, `coverage.fresh === true`, no provider errors, and a provider status other than `UNAVAILABLE`. A confirmed direct sanctions or issuer freeze finding remains `CRITICAL` even if other sources are incomplete. All results retain coverage and provider status so the verdict is never presented without its limitations.

## Factor scoring

Confidence is a value from 0 to 1; missing confidence defaults to 0.5. Each evidence factor reports its score, confidence, source name/identifier, timestamp when available, and explanation.

### Direct intelligence

Base severity points are `LOW 20`, `MEDIUM 42`, `HIGH 68`, and `CRITICAL 90`. A confirmed direct sanctions record receives 100 points. A confirmed issuer freeze receives 95. Unconfirmed `SANCTIONED` or `FROZEN` records use at least the `HIGH` base and keep the confirmation state explicit. The factor score is `round(base × confidence)`. A confirmed direct sanctions or freeze record forces `CRITICAL` by policy.

### Counterparty exposure

Exposure uses the counterparty's stated risk level, confidence, hop distance, and reported value. Hop 1 uses the full severity base; hop 2 uses 60% of it. Reported exposure adds 5 points at $10,000 or 10 points at $100,000, then confidence is applied. A single exposure factor is capped at 80. These are exposure indicators, not direct designations.

### Behavioral indicators

Each behavior finding supplies a transparent weight from 0 to 30 and confidence. Its score is `round(weight × confidence)`. Behavior factors are explicitly described as heuristics, and their aggregate contribution is capped at 45. Behavior alone does not create a confirmed designation.

### Aggregation

The base score is the maximum of the strongest direct factor, strongest exposure factor, or capped behavior total. Additional exposure points beyond the strongest exposure and one quarter of behavior points can add interaction points, capped at 20. The total is capped at 100. Verdict thresholds are applied after that aggregation, except for the confirmed sanctions/freeze override.

## Determinism and limitations

`calculateRisk(input)` is pure: it uses supplied findings and coverage only, does not read the clock, network, or database, and returns the same output for the same input. `riskModelVersion` is included so persisted screenings can record which rules were applied.

The model does not yet incorporate a live blockchain history, calibrated statistical probabilities, source-specific validation, sanctions-list matching tolerances, or an independently back-tested exposure policy. Until those are implemented, only deterministic fixtures and explicit caller-provided evidence can be scored. A missing or empty source response must never be converted into a complete-coverage claim by the caller.
