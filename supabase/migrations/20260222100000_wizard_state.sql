-- Ajout de la colonne wizard_state sur projects
-- Stocke l'état du wizard stepper : {"batiment":"validated","carte":"validated","synthese":"locked"}
ALTER TABLE projects ADD COLUMN IF NOT EXISTS wizard_state JSONB DEFAULT NULL;

COMMENT ON COLUMN projects.wizard_state IS 'État du wizard stepper (StepsState JSON). null = première visite.';
