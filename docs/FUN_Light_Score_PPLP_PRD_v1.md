# FUN ECOSYSTEM — Product Requirements Document
## Light Score & PLP Validation System

*Final dev-ready PRD for Angel A.I., PM, backend, smart contract, and data teams*

| Field | Value |
|-------|-------|
| **Version** | **v1.0 - Final working draft** |
| Product scope | Light Score, PLP validation, event/group/user attendance, FUN mint distribution |
| Immutable rule | PLP = PureLove Protocol |
| Mint split | 99% direct to user, 1% to platform |

**Purpose.** This PRD defines how FUN Ecosystem measures Light Score, validates actions using PLP, handles Zoom/Love House participation, and converts validated value into FUN mint events without turning the system into a simple engagement reward engine.

---

## 1. Product vision and design principles

Light Score is an unbounded number that can increase without limit. It represents validated light-bearing value, not raw activity volume and not social media engagement.

- The system must reward validated transformation and service, not mere posting frequency.
- Every mintable action must pass through PLP validation before any token distribution occurs.
- PLP has one fixed meaning everywhere in product, data, API, and smart-contract documentation: **PureLove Protocol**.
- No proof → no score. No score → no mint.
- The mint split is fixed at 99% to the user and 1% to the platform.

---

## 2. Problem statement

The ecosystem needs a practical, anti-fake, humane scoring model that can:

- guide users toward clear daily actions that increase light in a real way;
- verify group activities such as Zoom meditation, livestreams, and Love House participation without collapsing into vanity metrics;
- produce scores that are auditable, explainable, and compatible with future token mint logic;
- scale from simple proof submission in v1 to richer attendance, trust, and reputation systems in later phases.

---

## 3. Goals and non-goals

| Goals | Non-goals |
|-------|-----------|
| Define a canonical Light Score pipeline from action → proof → validation → score → mint. | Do not infer spiritual truth from biometrics alone. |
| Support event, group, and user-level verification for Zoom/Love House flows. | Do not use a single livestream link as complete proof for every participant. |
| Keep scoring explainable with pillar-level outputs and review paths. | Do not create a pure engagement rewards system. |
| Enable phased delivery: off-chain first, on-chain later. | Do not hard-freeze all economics into smart contracts in v1. |

---

## 4. Core concepts

### 4.1 User action groups

Users should see simple action categories in the app. These are behavioral entry points, not the validation engine itself.

| Action group | Definition | Examples |
|-------------|------------|----------|
| Inner Work | Personal practice that increases clarity and inner transformation. | Meditation, repentance, gratitude, reflection |
| Channeling | Sharing light-oriented teaching or guided presence with others. | Leading a session, sharing guided content |
| Giving | Providing money, time, or material support. | Financial giving, supplies, volunteer hours |
| Social Impact | Helping people beyond the immediate circle. | Community care, outreach, direct assistance |
| Service | Supporting the ecosystem's operation and long-term build. | Moderation, support, content ops, platform build |

### 4.2 PLP pillars

Every action is validated against all five pillars. These pillars are the filter layer and must not be confused with action categories.

| Pillar | Question | Meaning in product terms |
|--------|----------|--------------------------|
| Serving Life | Does this action support people, community, or Earth? | Impact beyond self |
| Transparent Truth | Is it real, traceable, and non-manipulative? | Proof quality and authenticity |
| Healing & Love | Does it reduce suffering or increase well-being? | Beneficial intent and effect |
| Long-term Value | Does it build durable value for the light economy? | Lasting contribution |
| Unity over Separation | Does it connect rather than divide? | Harmony and relational value |

---

## 5. System architecture

Canonical flow:

```
User action → Proof capture → Validation engine (PLP) → Light Score engine → Mint engine → Ledger / wallet / economy
```

- **Action layer** captures what the user says they did.
- **Proof layer** captures evidence that the action and/or event occurred.
- **Validation engine** combines A.I. analysis, community input, and system trust signals.
- **Light Score engine** produces an explainable score with pillar outputs and multiplier logic.
- **Mint engine** turns validated score into FUN distribution using the fixed 99/1 split.

---

## 6. Functional requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| FR-1 | Submit action | Users can submit an action with category, title, description, platform, and metadata. |
| FR-2 | Attach proof | Each action can include one or more proofs such as links, video, images, system logs, or on-chain transactions. |
| FR-3 | Validate via PLP | The backend must evaluate each action across the five PLP pillars. |
| FR-4 | Score explainability | The system must store pillar-level scores, validation reasons, flags, and final score outputs. |
| FR-5 | Review paths | Actions may be auto-validated, rejected, or routed to manual review. |
| FR-6 | Attendance support | Group events must support event, group, and user-level attendance data. |
| FR-7 | Minting | Only validated actions produce mint records. The system stores total mint and user/platform splits. |
| FR-8 | Auditability | Every critical transition is event-logged and queryable for replay and audit. |

---

## 7. Light Score model

Raw pillar values use a 0–10 range. The first implementation should preserve simple scoring semantics while allowing later tuning.

### 7.1 Raw formula

```
RawLightScore = (S × T × H × V × U) / 10^4
```

Where S=Serving Life, T=Transparent Truth, H=Healing & Love, V=Long-term Value, U=Unity over Separation.

### 7.2 Final score

```
FinalLightScore = RawLightScore × ImpactWeight × TrustMultiplier × ConsistencyMultiplier
```

- **ImpactWeight** reflects the practical reach and significance of the action type.
- **TrustMultiplier** reflects the user's historical reliability.
- **ConsistencyMultiplier** rewards steady practice over time without allowing spam to dominate.

### 7.3 Unbounded score rule

Light Score is defined as unbounded upward. The cumulative score can increase without limit as validated value accumulates over time. This applies to lifetime score and may also apply to periodic scores if product rules permit carry-forward or open-ended accumulation.

---

## 8. Mint logic

| Rule | Decision |
|------|----------|
| Mint eligibility | Only actions with validated status may mint. |
| Mint formula | `MintAmount = BaseMintRate × FinalLightScore` |
| User split | 99% of each mint goes directly to the user. |
| Platform split | 1% of each mint goes to the platform. |
| V1 recommendation | Use off-chain ledger and mint records first; defer hard on-chain economic locking until rules stabilize. |

---

## 9. Zoom / Love House attendance PRD

This section resolves the key product question raised by the team: how to validate group meditation on Zoom when a single Zoom window may represent 5–10 people in one Love House, while the event is also livestreamed to Facebook and YouTube.

### 9.1 Product conclusion

**A livestream link proves that the event happened. It does not prove that each individual truly participated.**

### 9.2 Required verification layers

| Layer | What it proves | Typical inputs | Scoring effect |
|-------|---------------|----------------|----------------|
| Event level | The session actually occurred. | Zoom meeting ID, host account, livestream links, start/end time, recording hash | Enables event eligibility |
| Group level | A Love House group actually gathered. | Group leader check-in, group photo/video, attendance summary | Enables group eligibility |
| User level | A specific person truly participated. | App check-in/check-out, host confirmation, presence logs, reflection response | Determines personal participation factor |
| Trust level | The account is historically reliable. | Prior attendance history, flags, confirmations, fraud signals | Adjusts multiplier and review strictness |

### 9.3 Face scan policy

A.I. face recognition may be used only as an optional supporting signal in later phases. It must not be the sole source of truth for Light Score and must not become a mandatory gate for all users.

- **Reason 1:** camera quality, lighting, and group seating make precise detection unreliable.
- **Reason 2:** one Zoom window may represent a whole Love House, so face count ≠ user count.
- **Reason 3:** biometrics are privacy-sensitive and should not define the user's spiritual or product truth.
- **Reason 4:** meaningful participation cannot be fully inferred from camera presence alone.

### 9.4 Event → Group → User model

The attendance model must represent three linked entities rather than one flat proof record.

| Entity | Key fields | Notes |
|--------|-----------|-------|
| Event | event_id, host_id, platform links, start/end time, recording hash | One meditation session |
| Group | group_id, event_id, leader_id, location/love_house_id, expected_count | One Love House or subgroup inside the event |
| Attendance | attendance_id, group_id, user_id, check_in_at, check_out_at, confirmation_status | One user's participation record |

### 9.5 Participation factor

Recommended v1 logic:

| Signal | Suggested contribution |
|--------|----------------------|
| User checked in and out | Strong positive signal |
| Stayed for threshold duration | Strong positive signal |
| Group leader confirmed presence | Positive signal |
| Submitted short post-session reflection | Positive signal |
| Missing proof or conflict flags | Negative signal / manual review |

### 9.6 Recommended v1 policy

- Do not score every participant merely because one person posted a Facebook or YouTube livestream link.
- Treat the livestream link as event proof, not personal proof.
- Require at least one user-level signal for individual scoring.
- Support group leader confirmation for Love House cases where one Zoom tile represents many people.
- Use random audit and trust history to reduce gaming.

---

## 10. Data model

Suggested relational core tables for v1:

| Table | Purpose | Sample key columns |
|-------|---------|-------------------|
| users | Identity, trust, aggregate metrics | id, wallet_address, trust_level, total_light_score |
| action_types | Action taxonomy | id, code, pillar_group, base_impact_score |
| user_actions | Submitted actions | id, user_id, action_type_id, status, source_platform |
| proofs | Attached evidence | id, action_id, proof_type, proof_url, file_hash |
| pplp_validations | Stored pillar scores and explanations | action_id, serving_life, transparent_truth, final_light_score |
| events | Group session records | id, host_user_id, platform_links, start_at, end_at |
| groups | Love House or subgroup records | id, event_id, leader_user_id, expected_count |
| attendance | Per-user participation records | id, group_id, user_id, check_in_at, check_out_at |
| mint_records | Mint outputs | id, action_id, mint_amount_total, mint_amount_user, mint_amount_platform |
| balance_ledger | Ledger entries | id, user_id, entry_type, amount, reference_id |

---

## 11. API surface

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/actions` | POST | Submit a user action |
| `/api/actions/{id}/proofs` | POST | Attach proof items to an action |
| `/api/actions/{id}/validate` | POST | Run PLP validation |
| `/api/actions/{id}/mint` | POST | Create mint record after validation |
| `/api/events` | POST | Create event for Zoom/livestream session |
| `/api/events/{id}/groups` | POST | Create Love House group nodes |
| `/api/groups/{id}/attendance` | POST | Submit or update attendance |
| `/api/users/{id}/light-profile` | GET | Read current score and trust summary |

---

## 12. Anti-fake and abuse controls

- **Duplicate proof detection:** the same link or recording hash cannot be reused freely across many unrelated actions.
- **Velocity limits:** cap the number of scored actions per day and cap high-impact actions more strictly.
- **Similarity scanning:** repeated near-identical descriptions reduce trust or trigger review.
- **Community conflict flags:** conflicting confirmations route the record to manual review.
- **Trust decay:** repeated suspicious activity lowers multiplier and increases review burden.

---

## 13. Operational workflow

1. Action submitted → proof attached → validation queued.
2. A.I. scoring runs first and stores pillar-level outputs plus flags.
3. Community or leader confirmation can be collected during a defined review window.
4. System trust signals are merged into final score calculation.
5. Validated actions create mint records and ledger entries.

---

## 14. Release plan

| Phase | Scope | Outcome |
|-------|-------|---------|
| Phase 1 | Action, proof, A.I. validation, admin review, off-chain mint ledger | Usable MVP with clear audit trail |
| Phase 2 | Event/group/user attendance, leader confirmation, trust engine, abuse automation | Reliable group meditation scoring |
| Phase 3 | Smart-contract minting, richer reputation graph, optional supporting biometrics | Scale and stronger on-chain integration |

---

## 15. Acceptance criteria

- The system rejects actions with no proof.
- The system stores all five PLP pillar scores for every validated action.
- A livestream link alone cannot generate personal attendance for all participants.
- One Zoom tile can represent a subgroup without collapsing the attendance model.
- Each mint record stores total mint, user mint, platform mint, and source action reference.
- The product can explain why an action was validated, rejected, or routed to review.

---

## 16. Final product rules for Angel A.I. and dev team

### Non-negotiable rules

- **PLP = PureLove Protocol.** No alternate definition is allowed in system docs.
- **Light Score is an unbounded upward number.**
- **Scoring is not engagement farming;** it is truth validation for value-bearing action.
- **99% of mint goes directly to the user; 1% goes to the platform.**
- **Livestream proof is event proof, not full individual proof.**
- **Face scan, if used later, is only a supporting signal** and never the sole source of truth.
