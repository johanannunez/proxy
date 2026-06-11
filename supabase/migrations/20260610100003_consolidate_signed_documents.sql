-- Workstream A1: fold signed_documents state into the documents spine.
--
-- After this migration, for rows with source = 'signed_document':
--   - source_ref stores the PROVIDER document/submission id directly
--     (DocuSeal submission id, or the legacy BoldSign document id), not the
--     signed_documents primary key.
--   - sent_at / sent_by / file_url / completed_at are absorbed from the
--     signed_documents record they previously pointed at.
-- The signed_documents table itself is NOT dropped here; physical removal
-- happens after Round 1 verification. All application code stops referencing it.

update documents d
set
  source_ref   = sd.boldsign_document_id,
  sent_at      = coalesce(d.sent_at, sd.sent_at),
  sent_by      = coalesce(d.sent_by, sd.sent_by),
  file_url     = coalesce(d.file_url, sd.signed_pdf_url),
  completed_at = coalesce(d.completed_at, sd.fully_executed_at, sd.signed_at)
from signed_documents sd
where d.source = 'signed_document'
  and d.source_ref = sd.id::text;

-- w9_access_log previously audited signed_documents rows. New audit rows point
-- at documents spine rows. The table is empty in every environment today, so
-- repointing the FK is safe and loses nothing.
alter table w9_access_log
  drop constraint if exists w9_access_log_document_id_fkey;
alter table w9_access_log
  add constraint w9_access_log_document_id_fkey
  foreign key (document_id) references documents(id) on delete set null;
