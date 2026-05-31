-- Rebrand: update system template seed data from "Parcel" to "Proxy".
UPDATE public.document_templates
SET
  signer_roles = ARRAY['Owner', 'Proxy'],
  description = CASE
    WHEN document_key = 'host_rental_agreement'
      THEN 'Property management agreement between the owner and Proxy.'
    ELSE description
  END
WHERE is_system = true
  AND 'Parcel' = ANY(signer_roles);
