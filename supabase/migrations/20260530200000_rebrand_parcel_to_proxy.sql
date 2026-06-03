-- Rebrand: rename parcel_team table to proxy_team
ALTER TABLE parcel_team RENAME TO proxy_team;

-- Migrate any existing cleaning_choice values (parcel → proxy)
UPDATE properties SET cleaning_choice = 'proxy' WHERE cleaning_choice = 'parcel';

-- Rename delivery_method values: portal → workspace
UPDATE messages SET delivery_method = 'workspace' WHERE delivery_method = 'portal';
UPDATE messages SET delivery_method = 'workspace_email' WHERE delivery_method = 'portal_email';
UPDATE finance_requests SET delivery_method = 'workspace' WHERE delivery_method = 'portal';
UPDATE finance_requests SET delivery_method = 'workspace_email' WHERE delivery_method = 'portal_email';
