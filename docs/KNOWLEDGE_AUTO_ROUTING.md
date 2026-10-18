# Automatic routing of new Angel knowledge

## Behavior
- All new `knowledge_documents` inserts use the same database insert trigger, including admin upload, Google save, URL ingestion, saved chat, templates, and external ingestion.
- A selected canonical folder is retained. A selected folder with an explicitly approved legacy alias resolves to the existing canonical destination.
- Unknown explicitly selected folders remain unchanged for administrator review; no title/content classification or fuzzy matching occurs.
- Missing selection uses the existing source routing (exact `source_ref` first, then source default, then `__default__`); without routing, it uses `Các tài liệu khác`.
- The trigger only changes `NEW.folder_id`; it does not update existing documents, chunks, embeddings, content or ingestion state. Subsequent manual moves remain supported.
- The admin folder form reuses the existing canonical destination for recognized aliases and preselects it for file/Google uploads. That frontend change needs publication; the database rule is already active on the shared Cloud instance.
- Existing external ingestion remains unchanged: incoming Telegram labels retain their ingestion-policy checks; unknown supplied labels are skipped for admin mapping.

## Verification — 2026-10-17
- 15 focused tests passed, including SQL taxonomy parity for 20 canonical names and all approved aliases, no title guessing, canonical chat route and sync policy regressions.
- `scripts/verification/knowledge-routing.sql` exercised inserts with default selection, an approved legacy folder, an unknown explicit folder and source routing; tested a later manual move and content/chunk preservation. All fixtures rolled back.
- Authenticated Preview `/admin/knowledge`: entering `Du hành vũ trụ` reused `Các bài dẫn thiền`, preserved 20 folders, and preselected the canonical upload folder.
- Actual file upload without selection read back through the UI and database under `Các tài liệu khác`. The test document and its Storage file were removed after verification.
- Build log: build OK. No Publish. No partner Docs run was executed or claimed.

## Rollback
Disable only the `route_new_knowledge_document` trigger through an authorized schema migration to restore previous insert behavior. Revert the admin alias handling independently if needed. No old records were bulk modified; already-created documents retain their assigned folder unless an administrator explicitly moves them.

## Taxonomy changes
The SQL canonical resolver mirrors `_shared/knowledge-folders.ts`. Update both through a new migration and keep parity tests passing; do not alter historical chunk labels or reembed for folder-name changes.