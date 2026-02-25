// Types pour les projets HANGAR3D

import type { FinanceState, FinanceSnapshot } from "@/lib/types/finance";

export type ProjectMode = "PRO_SERVICE" | "CLIENT_SELF_SERVICE";

export type ProjectStatus = 
  | "draft" 
  | "submitted" 
  | "accepted" 
  | "rejected" 
  | "returned";

export type UserRole = "admin" | "pro" | "partner" | "client";

export interface Project {
  id: string;
  org_id: string;
  name: string;
  mode: ProjectMode;
  status: ProjectStatus;
  created_by_role: "pro" | "client";
  owner_user_id: string;
  assigned_to_org_id: string | null;
  decision_reason_code: string | null;
  decision_comment: string | null;
  decided_by_user_id: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  /** État du wizard stepper, null si première visite */
  wizard_state: StepsState | null;
  /** État finance éditable (tarifs, coûts, hypothèses), null si pas encore configuré */
  finance_state: FinanceState | null;
  /** Snapshot KPIs figé à la validation de l'étape finance */
  finance_snapshot: FinanceSnapshot | null;
  /** Token de partage public (généré à la demande) */
  share_token: string | null;
}

export interface ProjectWithOrg extends Project {
  organization?: {
    name: string;
  };
}

// Pour l'affichage dans la liste
export interface ProjectListItem {
  id: string;
  name: string;
  mode: ProjectMode;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

// ─── Wizard stepper ────────────────────────────────────────────────

export type StepId = "batiment" | "carte" | "finance" | "synthese";

/**
 * validated  – L'étape est complète et validée (coche verte)
 * in_progress – L'utilisateur est sur cette étape
 * locked     – L'étape n'est pas encore accessible (étape précédente non validée)
 * stale      – Était validée, mais une étape antérieure a changé → à re-valider
 */
export type StepStatus = "validated" | "in_progress" | "locked" | "stale";

export interface WizardStep {
  id: StepId;
  label: string;
  icon: string;
  index: number;
}

export const WIZARD_STEPS: readonly WizardStep[] = [
  { id: "batiment", label: "Bâtiment", icon: "🏗️", index: 0 },
  { id: "carte", label: "Carte & contraintes", icon: "🗺️", index: 1 },
  { id: "finance", label: "Finance", icon: "💰", index: 2 },
  { id: "synthese", label: "Synthèse", icon: "📋", index: 3 },
] as const;

export interface StepsState {
  batiment: StepStatus;
  carte: StepStatus;
  finance: StepStatus;
  synthese: StepStatus;
}
