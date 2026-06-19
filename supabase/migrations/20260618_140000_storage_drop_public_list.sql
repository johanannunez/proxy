-- H1: stop anonymous ENUMERATION of the public storage buckets.
-- These broad {public} SELECT policies on storage.objects let anyone LIST every file in the
-- bucket (confirmed: the property-documents tree was walkable with the anon key). Public object
-- URLs (/storage/v1/object/public/<bucket>/<path>) do NOT depend on this policy — they are served
-- because the bucket is public — so dropping it removes listing without breaking any stored URL.
-- A later migration will make property-documents fully private + signed-URL-only (the ironclad
-- end state), once the readers are switched off getPublicUrl.
drop policy if exists "property-documents: public read" on storage.objects;
drop policy if exists "public read document-assets" on storage.objects;
drop policy if exists "Public read form covers" on storage.objects;
