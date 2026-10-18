# PRD v1.0 vs Current Implementation — Gap Analysis
**Date:** 14 Apr 2026  
**Scope:** Compare `docs/FUN_Light_Score_PPLP_PRD_v1.md` against Angel AI codebase + database

---

## Legend
- ✅ **Implemented** — Working in production
- ⚠️ **Partial** — Exists but differs from PRD spec
- ❌ **Missing** — Not yet built

---

## 1. Product Vision & Design Principles
| Item | Status | Notes |
|------|--------|-------|
| PLP = PureLove Protocol | ✅ | Defined across codebase and edge functions |
| No proof → no score → no mint | ✅ | Hard gate in `pplp-score-action` and `pplp-compute-daily-scores` |
| Mint split 99% user / 1% platform | ✅ | Implemented in `pplp-epoch-allocate` and `fun_distribution_logs` |
| Light Score is unbounded upward | ✅ | Cumulative in `light_score_ledger` |
| Not engagement farming | ✅ | Anti-farm risk scoring, ego penalty, velocity limits |

---

## 2. Core Concepts (§4)

### 2.1 User Action Groups
| PRD Group | Status | Current Mapping |
|-----------|--------|----------------|
| Inner Work | ⚠️ | Mapped to journals/gratitude but no explicit `action_types` taxonomy table |
| Channeling | ⚠️ | Partially covered by posts/content but no dedicated category |
| Giving | ✅ | `coin_gifts`, `process-coin-gift` edge function |
| Social Impact | ⚠️ | `community_helps` exists but not categorized as "Social Impact" |
| Service | ⚠️ | Bounty tasks, moderation exist but not labeled per PRD |

**Gap:** ~~No `action_types` table~~ ✅ **RESOLVED** — `action_types` lookup table created with `code`, `pillar_group`, `base_impact_score`. `pplp-api-v1` validates against it dynamically.

### 2.2 PLP Pillars (5 pillars)
| Pillar | Status | Current Column |
|--------|--------|---------------|
| Serving Life (S) | ✅ | `pillar_s` in `pplp_scores` |
| Transparent Truth (T) | ✅ | `pillar_t` in `pplp_scores` |
| Healing & Love (H) | ✅ | `pillar_h` in `pplp_scores` |
| Long-term Value (V) | ⚠️ | `pillar_c` (mapped as "Contribution") — naming mismatch |
| Unity over Separation (U) | ✅ | `pillar_u` in `pplp_scores` |

**Gap:** `pillar_c` should represent "Long-term Value" per PRD but is named/mapped as generic "Contribution". Semantic alignment needed.

---

## 3. System Architecture (§5)

| Layer | Status | Implementation |
|-------|--------|---------------|
| Action layer | ✅ | `pplp-submit-action`, `pplp_actions` table |
| Proof layer | ✅ | Dedicated `proofs` table + `pplp-api-v1` attach proof endpoint |
| Validation engine (AI) | ✅ | `pplp-ai-pillar-analyzer` (Gemini Flash) |
| Validation engine (Community) | ✅ | `pplp-submit-rating`, `pplp_scores.rater_user_id` |
| Validation engine (System Trust) | ✅ | `combineSignals()` with 60/20/20 weighting |
| Light Score engine | ✅ | `pplp-compute-daily-scores`, `pplp-score-action` |
| Mint engine | ✅ | `pplp-epoch-allocate`, `pplp-claim-fun`, `pplp-mint-fun` |

---

## 4. Light Score Model (§7) — ✅ IMPLEMENTED

### PRD Formula (Multiplicative)
```
RawLightScore = (S × T × H × V × U) / 10^4
FinalLightScore = Raw × ImpactWeight × TrustMultiplier × ConsistencyMultiplier
```
- If any pillar = 0, score = 0 (built-in anti-fake) — enforced via ZERO_GATE checks
- Implemented in: `scoring-engine.ts`, `pplp-score-action`, `pplp-compute-daily-scores`
- `scored_by` tag: `pplp_engine_prd_v1`

---

## 5. Mint Logic (§8)

| Rule | Status | Notes |
|------|--------|-------|
| Only validated actions mint | ✅ | `pplp-epoch-allocate` checks eligibility |
| `MintAmount = BaseMintRate × FinalLightScore` | ✅ | `BASE_MINT_RATE = 10.0` in PPLP_CONSTANTS |
| 99/1 split | ✅ | Implemented in distribution logs |
| Off-chain ledger first | ✅ | `light_score_ledger`, `pplp_mint_allocations` |

---

## 6. Zoom / Love House Attendance (§9) — ✅ IMPLEMENTED

| PRD Requirement | Status | Notes |
|-----------------|--------|-------|
| `attendance_events` table | ✅ | Zoom, Livestream, Love House, Community events |
| `pplp_groups` table | ✅ | Love House subgroups with leader confirmation |
| `pplp_attendance` table | ✅ | Per-user participation with check-in/out |
| Event-level proof | ✅ | Via `pplp-api-v1` create event endpoint |
| Group-level proof (leader confirmation) | ✅ | Via `pplp-api-v1` create group endpoint |
| User-level proof (check-in/out, reflection) | ✅ | Via `pplp-api-v1` submit attendance endpoint |
| Participation factor scoring | ✅ | `compute_participation_factor()` DB function + API confidence calc |
| Face scan as optional signal only | ✅ | Not used (correct per PRD v1) |

---

## 7. Data Model (§10) — ✅ COMPLETE

| PRD Table | Exists? | Current Equivalent | Gap |
|-----------|---------|-------------------|-----|
| `users` | ✅ | `profiles` | ✅ Match |
| `action_types` | ✅ | `action_types` table + `PPLP_ACTION_TYPES` enum | ✅ DB lookup table |
| `user_actions` | ✅ | `pplp_actions` | ✅ |
| `proofs` | ✅ | `public.proofs` table | ✅ |
| `pplp_validations` | ✅ | `pplp_scores` | ✅ |
| `events` | ✅ | `attendance_events` | ✅ |
| `groups` | ✅ | `pplp_groups` | ✅ |
| `attendance` | ✅ | `pplp_attendance` | ✅ |
| `mint_records` | ✅ | `pplp_mint_requests` + `pplp_mint_allocations` | ✅ |
| `balance_ledger` | ✅ | `camly_coin_transactions` + `fun_distribution_logs` | ✅ |

---

## 8. API Surface (§11) — ✅ COMPLETE (OpenAPI v1)

Reference: `docs/FUN_Backend_OpenAPI_v1.yaml`

| OpenAPI Endpoint | Status | Edge Function |
|-----------------|--------|---------------|
| `POST /v1/actions` | ✅ | `pplp-api-v1` (gateway) + `pplp-submit-action` (legacy) |
| `GET /v1/actions/{id}` | ✅ | `pplp-api-v1` |
| `POST /v1/actions/{id}/proofs` | ✅ | `pplp-api-v1` |
| `POST /v1/actions/{id}/validate` | ✅ | `pplp-api-v1` → delegates to `pplp-score-action` |
| `POST /v1/actions/{id}/mint` | ✅ | `pplp-api-v1` → delegates to `pplp-claim-fun` |
| `GET /v1/users/{id}/light-profile` | ✅ | `pplp-api-v1` + `pplp-light-profile` (enhanced) |
| `POST /v1/events` | ✅ | `pplp-api-v1` |
| `POST /v1/events/{id}/groups` | ✅ | `pplp-api-v1` |
| `POST /v1/events/{id}/groups/{id}/attendance` | ✅ | `pplp-api-v1` |

### Response Schema Compliance
- ✅ All responses match OpenAPI `ErrorResponse` format (`code`, `message`, `details`)
- ✅ Action statuses: `submitted | proof_pending | under_review | validated | rejected | minted | flagged`
- ✅ Pillar scores returned on 0-10 scale per `PPLPScores` schema
- ✅ `UserLightProfileResponse` includes `trust_level`, `pillar_summary`, `total_fun_minted`
- ✅ `AttendanceResponse` includes computed `attendance_confidence`

---

## 9. Anti-Fake & Abuse Controls (§12)

| Control | Status | Implementation |
|---------|--------|---------------|
| Duplicate proof detection | ✅ | `pplp-detect-fraud`, file hash checks, proof URL dedup |
| Velocity limits | ✅ | Rate limiting, daily caps, cooldown 30s |
| Similarity scanning | ✅ | Jaccard similarity 80% threshold |
| Community conflict flags | ⚠️ | `fraud_alerts` exists but no community-driven conflict resolution UI |
| Trust decay | ✅ | `computeDecayFactor()` in scoring engine |
| Global daily cap | ✅ | `MAX_SCORED_ACTIONS_PER_DAY = 10` |
| High-impact daily cap | ✅ | `MAX_HIGH_IMPACT_ACTIONS_PER_DAY = 3` |
| Truth gate | ✅ | `MIN_TRUTH_FOR_AUTO_APPROVAL = 3.0` |

---

## 10. Functional Requirements (§6)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-1 | Submit action | ✅ |
| FR-2 | Attach proof | ✅ Dedicated `proofs` table + API endpoint |
| FR-3 | Validate via PLP | ✅ |
| FR-4 | Score explainability | ✅ Pillar scores + reason codes stored |
| FR-5 | Review paths (auto/reject/manual) | ✅ Auto + reject + flagged (truth gate) |
| FR-6 | Attendance support | ✅ Events, groups, attendance API |
| FR-7 | Minting | ✅ |
| FR-8 | Auditability | ✅ `scoring_rules` versioning, `light_score_ledger` |

---

## 11. Release Plan Mapping

| Phase | PRD Scope | Status |
|-------|-----------|--------|
| **Phase 1** | Action, proof, AI validation, admin review, off-chain mint ledger | ✅ **Complete** |
| **Phase 2** | Event/group/user attendance, leader confirmation, trust engine, abuse automation | ✅ **Complete** |
| **Phase 3** | Smart-contract minting, reputation graph, optional biometrics | ⚠️ **BSC contract exists**, reputation graph partial |

---

## 12. Backend Pseudocode Alignment

Reference: `docs/FUN_Backend_Pseudocode.md`

| Pseudocode Spec | Status | Notes |
|---|---|---|
| `PPLP_CONSTANTS` block (§1) | ✅ | `scoring-engine.ts` + `pplp-score-action` |
| `MAX_SCORED_ACTIONS_PER_DAY = 10` | ✅ | Global daily cap enforced |
| `MAX_HIGH_IMPACT_ACTIONS_PER_DAY = 3` | ✅ | High-impact cap enforced |
| `MIN_TRUTH_FOR_AUTO_APPROVAL = 3.0` | ✅ | Truth gate: T < 30/100 → flagged |
| `BASE_MINT_RATE = 10.0` | ✅ | In `PPLP_CONSTANTS` |
| `combineSignals()` (AI 60%, Community 20%, Trust 20%) | ✅ | Implemented |
| Dedicated `proofs` table | ✅ | `public.proofs` with RLS |
| `attendance_events` table | ✅ | All event types supported |
| `pplp_groups` table | ✅ | Love House subgroups |
| `pplp_attendance` table | ✅ | Per-user participation |
| `compute_participation_factor()` | ✅ | DB function + API confidence calc |

---

## 13. OpenAPI v1 Alignment

Reference: `docs/FUN_Backend_OpenAPI_v1.yaml`

| Aspect | Status | Notes |
|---|---|---|
| Unified API gateway (`pplp-api-v1`) | ✅ | Path-based routing for all 9 endpoints |
| `SubmitActionRequest` schema | ✅ | `action_type`, `title`, `source_platform`, `metadata` |
| `ActionResponse` status enum | ✅ | 7-state enum: submitted → minted |
| `AttachProofRequest` proof_type enum | ✅ | 7 proof types validated |
| `ValidationResponse` with PLP scores | ✅ | Pillar scores on 0-10 scale |
| `MintResponse` with split amounts | ✅ | user/platform amounts |
| `UserLightProfileResponse` with pillar_summary | ✅ | 5-pillar averages + trust_level |
| `CreateEventRequest` with livestream_links | ✅ | Zoom, Facebook, YouTube support |
| `CreateGroupRequest` | ✅ | leader_user_id, estimated_participants |
| `SubmitAttendanceRequest` with attendance_mode | ✅ | 4 modes + optional_signals |
| `ErrorResponse` standard format | ✅ | `code`, `message`, `details` |

---

## 14. Jira Task Breakdown Alignment

Reference: `docs/FUN_Jira_Task_Breakdown_v1.docx`

### EPIC 1: Core Action & Proof System — ✅ COMPLETE
| Task | Status | Implementation |
|------|--------|----------------|
| Design action submission API | ✅ | `pplp-api-v1` POST /actions |
| Implement action_types and user_actions tables | ✅ | `action_types` lookup + `pplp_actions` + `user_actions` view |
| Build proof upload service | ✅ | `pplp-api-v1` POST /actions/{id}/proofs, `proofs` table |
| Implement proof validation rules | ✅ | No Proof → No Score gate in scoring engine |
| Store metadata and hashes for anti-duplicate | ✅ | `evidence_hash`, `action_hash` in `pplp_actions` |

### EPIC 2: Validation Engine (PLP) — ✅ COMPLETE
| Task | Status | Implementation |
|------|--------|----------------|
| Implement AI scoring service (5 pillars) | ✅ | `pplp-ai-pillar-analyzer` (Gemini Flash) |
| Integrate community review system | ✅ | `pplp-submit-rating`, `pplp_ratings` |
| Build trust score computation | ✅ | `combineSignals()` 60/20/20 weighting |
| Combine AI + community + trust | ✅ | `pplp-score-action` composite scoring |
| Flag system for manual review | ✅ | Truth gate < 3.0 → flagged, `fraud_alerts` |

### EPIC 3: Light Score Engine — ✅ COMPLETE
| Task | Status | Implementation |
|------|--------|----------------|
| Implement multiplicative scoring formula | ✅ | `(S×T×H×V×U)/10^4` in scoring engine |
| Add impact weight, trust, consistency multipliers | ✅ | `ImpactWeight × TrustMultiplier × ConsistencyMultiplier` |
| Handle edge cases (zero pillar = zero) | ✅ | ZERO_GATE checks |
| Persist final Light Score | ✅ | `light_score_ledger`, `pplp_scores` |

### EPIC 4: Mint Engine — ✅ COMPLETE
| Task | Status | Implementation |
|------|--------|----------------|
| Implement mint calculation logic | ✅ | `pplp-epoch-allocate`, `pplp-claim-fun` |
| Apply 99% user / 1% platform split | ✅ | `fun_distribution_logs` |
| Prevent duplicate mint per action | ✅ | `action_id` unique constraint |
| Store mint_records and ledger entries | ✅ | `pplp_mint_requests` + `pplp_mint_allocations` |
| Integrate with smart contract | ⚠️ | BSC testnet contract ready, mainnet TBD |

### EPIC 5: Event / Group / Attendance — ✅ COMPLETE
| Task | Status | Implementation |
|------|--------|----------------|
| Create event entity (Zoom session) | ✅ | `attendance_events` + API |
| Create group (Love House) mapping | ✅ | `pplp_groups` + API |
| Build user attendance tracking | ✅ | `pplp_attendance` check-in/out |
| Implement participation scoring factor | ✅ | `compute_participation_factor()` DB function |
| Support livestream as event-level proof | ✅ | `livestream_link` on events |

### EPIC 6: Frontend User Flow — ✅ COMPLETE
| Task | Status | Implementation |
|------|--------|----------------|
| Action submission UI | ✅ | Earn page + PLP integration |
| Proof upload UI | ✅ | `/proof-upload` page + `ProofUploadPanel` component |
| Light Score display UI | ✅ | `FUNMoneyStatsBanner`, mint page |
| Validation explanation UI (5 pillars) | ✅ | `ValidationDetailCard` with radar chart + pillar bars |
| User Light Profile dashboard | ✅ | `/light-profile` page with radar, history chart, trust level |

### EPIC 7: DevOps & Infrastructure — ⚠️ PARTIAL
| Task | Status | Implementation |
|------|--------|----------------|
| Setup PostgreSQL database | ✅ | Lovable Cloud (Supabase) |
| Setup Redis queue for async jobs | ❌ | Not implemented — edge functions are synchronous |
| Implement event-driven architecture | ⚠️ | DB triggers exist, no pub/sub |
| Logging & monitoring | ⚠️ | Edge function logs available, no centralized dashboard |
| CI/CD pipeline setup | ✅ | Lovable auto-deploy |

### EPIC 8: Anti-Fraud & Security — ✅ MOSTLY COMPLETE
| Task | Status | Implementation |
|------|--------|----------------|
| Duplicate proof detection | ✅ | `pplp-detect-fraud`, hash checks |
| Velocity limits (daily action caps) | ✅ | `MAX_SCORED_ACTIONS_PER_DAY = 10` |
| Similarity detection (content spam) | ✅ | Jaccard similarity 80% threshold |
| Trust decay system | ✅ | `computeDecayFactor()` |
| Manual audit tools | ⚠️ | Admin panel exists, no dedicated audit workflow |

---

## 15. Sprint Plan Alignment

Reference: `docs/FUN_Sprint_Plan_v1.docx`

| Sprint | Scope | Status |
|--------|-------|--------|
| **Sprint 1** | Repo, CI/CD, core tables (`action_types`, `pplp_actions`, `proofs`), action/proof APIs, basic frontend | ✅ **Complete** |
| **Sprint 2** | PLP validation (5 pillars), AI scoring (`pplp-ai-pillar-analyzer`), admin panel, Light Score engine | ✅ **Complete** |
| **Sprint 3** | Light Score formula (multiplicative), Mint engine (`pplp-epoch-allocate`), 99/1 split, anti-fraud, dashboard | ✅ **Complete** |
| **Sprint 4** | Events, Love House groups, attendance, participation factor, logging & monitoring | ✅ **Complete** |

---

## 16. System Diagram v2 Alignment

Reference: `docs/FUN_Ecosystem_v2_Full_System_Diagram.mmd`

| Layer | Status | Notes |
|-------|--------|-------|
| L1: User Actions (8 platforms) | ⚠️ | Angel AI + Zoom active; FUN Academy/Charity/Market/Play = future |
| L2: PLP Engine | ✅ | `pplp-api-v1` gateway |
| L3: Trust & Anti-Fake | ✅ | Sybil detection, behavior check, consistency |
| L4: Light Score Engine | ✅ | 5-pillar multiplicative formula |
| L5: Verified Value Detection | ✅ | No Proof → No Score gate |
| L6: Reward Engine | ✅ | `pplp-epoch-allocate` |
| L7: Mint Engine | ✅ | 99/1 split + vesting (25/75) |
| L8: Distribution + Vesting | ✅ | `pplp-claim-fun` + LockedGrant |
| L9: Economy | ⚠️ | FUN Profile active; sub-products future |
| L10: Feedback Loop / AI Learning | ⚠️ | Fraud scanner exists; dynamic weight adjustment not yet |

---

## 17. Remaining Items

### 🟡 P1 — Nice to Have (COMPLETED)
1. ~~**Validation explanation UI** (EPIC 6)~~ ✅ `ValidationDetailCard` with 5-pillar radar chart
2. ~~**Dedicated proof upload UI** (EPIC 6)~~ ✅ `/proof-upload` page + `ProofUploadPanel`
3. ~~**User Light Profile dashboard** (EPIC 6)~~ ✅ `/light-profile` page with radar, history, trust level
4. **Community conflict resolution UI**: `fraud_alerts` exists but no user-facing flow
5. **Dynamic trust levels**: `decayTrustForSpam` / `increaseTrustForVerifiedConsistency`

### 🟢 P2 — Phase 3
6. **On-chain FUNMoneyMinter mainnet deployment**: Testnet ready
7. **Reputation graph**: Cross-platform reputation aggregation
8. **Redis async queue** (EPIC 7): For heavy validation jobs
9. **Optional biometrics**: Face scan as signal (not required per PRD v1)

---

## Founder Dashboard Alignment

| Panel | Status | Implementation |
|-------|--------|---------------|
| Overview (KPIs, DAU/WAU/MAU) | ✅ | `FounderDashboard.tsx` → OverviewPanel |
| User Insights (Top users, flagged, streaks) | ✅ | UserInsightsPanel |
| PLP Analytics (5-pillar radar, distribution) | ✅ | PPLPAnalyticsPanel |
| Anti-Fake Monitor (fraud alerts, review queue) | ✅ | AntiFakeMonitorPanel |
| Event & Love House (attendance, groups) | ✅ | EventLoveHousePanel |
| Economy Flow (99/1 split, mint trend) | ✅ | EconomyFlowPanel |
| Real-Time Alerts (spikes, anomalies) | ✅ | RealTimeAlertsPanel |

Route: `/admin/founder-dashboard` — accessible via Admin Nav Toolbar ("Founder" link).
