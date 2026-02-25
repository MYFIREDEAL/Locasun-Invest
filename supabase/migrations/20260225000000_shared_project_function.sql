-- ============================================================================
-- Migration: Fonction publique pour lecture par share_token (bypass RLS)
-- Description: Permet de charger un projet + config par token sans être authentifié
-- ============================================================================

-- Fonction SECURITY DEFINER = s'exécute avec les droits du créateur (bypass RLS)
-- Seuls les projets ayant un share_token non null sont accessibles.

CREATE OR REPLACE FUNCTION public.get_shared_project(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project record;
  v_config record;
  v_result jsonb;
BEGIN
  -- Charger le projet par son token
  SELECT id, name, finance_snapshot
    INTO v_project
    FROM projects
   WHERE share_token = p_token
   LIMIT 1;

  IF v_project IS NULL THEN
    RETURN NULL;
  END IF;

  -- Charger le building config le plus récent
  SELECT params, derived
    INTO v_config
    FROM building_configs
   WHERE project_id = v_project.id
   ORDER BY created_at DESC
   LIMIT 1;

  -- Construire le résultat JSON
  v_result := jsonb_build_object(
    'project', jsonb_build_object(
      'id', v_project.id,
      'name', v_project.name
    ),
    'snapshot', COALESCE(to_jsonb(v_project.finance_snapshot), 'null'::jsonb),
    'building_config', CASE
      WHEN v_config IS NOT NULL THEN jsonb_build_object(
        'params', v_config.params,
        'derived', v_config.derived
      )
      ELSE 'null'::jsonb
    END
  );

  RETURN v_result;
END;
$$;

-- Autoriser l'appel par les utilisateurs anon (non authentifiés)
GRANT EXECUTE ON FUNCTION public.get_shared_project(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_shared_project(text) TO authenticated;
