# Knowledge normalization — 2026-10-17

## Executed on Angel

- Folder inventory: 62 → 20. Documents: 2,912 → 2,912 (2,905 undeleted, 7 soft-deleted). Chunks: 43,293 → 43,293. Non-null embeddings: 43,293. Unassigned documents: 1 → 0.
- Preserved IDs of populated canonical folders, including Father, Founder, meditation, Kingdom, Cosmos, Urantia and LoveHUB. Names now match the uploaded 20-name list exactly.
- Approved nine meditation groups merged into Các bài dẫn thiền: 199 undeleted documents.
- Approved Telegram groups, Tài liệu chung, exchange group and the unassigned document merged into Các tài liệu khác: 1,255 undeleted documents.
- Routing references were reassigned before obsolete folders were deleted; no source-routing row was deleted. All remaining folders are roots.
- Transaction captured every document's non-folder/non-updated-at fields and aborted if any changed. It also checked document and chunk counts. No chunk or embedding update was issued; no re-ingestion was requested.
- Shared explicit aliases now resolve incoming external-ingest folder labels; unknown supplied names are skipped for admin mapping rather than guessed or created. Missing folder defaults to Các tài liệu khác. Telegram quality/role/pause rules still use the original incoming label.
- Deployed only knowledge-external-ingest. PLP template folder constant changed to PLP in preview source, preventing recreation of PLP Documents after publication.
- FUN ID flag, chat functions, schemas, migrations, secrets, Storage and auth policies were not changed. No Publish.

## Final undeleted inventory

| Folder | Documents |
|---|---:|
| Hồ sơ dự án | 95 |
| Vương Quốc FUN | 46 |
| Camly Coin | 368 |
| FUN Money | 0 |
| FUN Wallet | 0 |
| Angel AI | 7 |
| FUN Profile | 0 |
| FUN Academy | 0 |
| Green Earth | 0 |
| FUN Cosmos | 20 |
| FUN Charity | 0 |
| FUN Play | 0 |
| FUN Farm | 0 |
| LoveHUB | 44 |
| Các bài viết của Father | 571 |
| Các bài viết của Founder Camly Duong | 7 |
| Các bài dẫn thiền | 199 |
| PLP | 80 |
| Sách Urantia | 213 |
| Các tài liệu khác | 1,255 |

## Verification

- 16/16 tests passed: canonical taxonomy, approved aliases, no guessing, canonical chat-route regression and Urantia security tests.
- Authenticated real admin page `/admin/knowledge` showed 20 folders, 2,905 documents, 43,293 chunks and 7 soft-deleted documents.
- Latest preview build log: build OK.
- Actual new upload and authenticated external-ingest request were not performed; no test knowledge was inserted.
- Existing chunk folder labels remain historical by design. Urantia canary still filters historical SÁCH URANTIA labels; exact-paper RPC filters by paper number, not current folder name. Future mixed historical/new chunk labels should be handled through stable document identity in a separately approved retrieval change.

## docs.fun.rich action list — not executed

Read-only snapshot has canonical-first mappings already in `src/lib/import-mapping.ts`. The deployed revision and scheduler remain unverified.

1. Obtain write access and inspect live sync settings, caller schedule and recent run counts.
2. Keep the 20 exact-name mappings; disable fuzzy/title guessing for Angel imports and flag unmatched names for review.
3. Existing rows are skipped by source URL, so a normal run does not propagate folder renames. Preview/apply re-filing for old records; respect the existing meditation freeze and seek its authorized handling rather than bypassing it.
4. Prove export pagination completeness and explain exclusions: images, Telegram links/sources and non-HTTP storage paths are filtered. Counts between stores are not expected to match automatically.
5. Test several real uploads end-to-end: Angel folder → export → docs destination → read-back. Include meditation and miscellaneous cases. Do not report verified until this is done.
6. Clarify whether the requested 1:1 means platform mapping or a full mirror: current code maps meditation titles into course subfolders and does not mirror metadata changes, ordinary-file updates or deletions.
7. Correct technical documentation to reflect canonical-first mapping, actual exclusions, external scheduler dependency and non-mirroring behavior.

## Audit and rollback limitations

## Daily synchronization request — 2026-10-17

- Angel Preview `/admin/knowledge` now displays the requested 24-hour cadence, "Awaiting activation on Docs", and unverified last/next run. Authenticated Vietnamese and English UI verified; six policy/taxonomy tests passed; build OK. No backend deployment or Publish.
- No actual schedule was changed: docs.fun.rich snapshot is read-only, and no authorized partner status interface is available in Angel. Export requests and local ingestion are not evidence of successful destination sync.
- Required partner action: live `docs.fun.rich/admin` → Automatic sync → Every day (frequencyHours 24); keep automatic sync enabled and auto-publish unchanged. Read settings back and inspect subsequent run history.
- The partner's interval gate is not a fixed-time daily schedule: it allows a run after roughly 23h59m from the last completed run, including manual/error runs. Identify the external scheduled caller and adjust its real cadence if the requirement is one callback per day; do not create a second Angel job or use the import-trigger endpoint as a status probe.
- Remaining blocker: writable access to Docs and its external scheduler, plus authorized run telemetry for a live status display in Angel.

The successful transaction validates preservation but its temporary snapshots are not retained. There is **no exact pre-change per-document folder backup from this run**. Existing knowledge_document_backups latest snapshot is 2026-10-11 (2,855 documents), so it is not a complete 2026-10-17 rollback source.

Canonical-name changes can be reversed on preserved folder IDs. Split-folder restoration requires the prior inventory plus a verified per-document assignment source; do not guess assignments from historical chunk labels, which already differed from live folder assignments before this operation. A full exact reversal must use an authorized pre-change Cloud backup if available; otherwise report it unavailable. Reverting external-ingest source can restore previous intake behavior independently, but would permit legacy folders to be recreated.