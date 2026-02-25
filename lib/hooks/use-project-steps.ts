"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StepId, StepsState } from "@/lib/types/project";
import { WIZARD_STEPS } from "@/lib/types/project";
import { saveWizardState } from "@/lib/actions/projects";

/* ──────────────────── helpers ──────────────────── */

/** Ordre linéaire des étapes */
const STEP_ORDER: readonly StepId[] = WIZARD_STEPS.map((s) => s.id);

function indexOf(step: StepId): number {
  return STEP_ORDER.indexOf(step);
}

const VALID_STATUSES = new Set<string>(["validated", "in_progress", "locked", "stale"]);

/** Valide qu'un objet a la bonne shape pour être un StepsState */
function isValidStepsState(obj: unknown): obj is StepsState {
  if (!obj || typeof obj !== "object") return false;
  const rec = obj as Record<string, unknown>;
  for (const sid of STEP_ORDER) {
    if (!VALID_STATUSES.has(rec[sid] as string)) return false;
  }
  return true;
}

/** Calcule l'état initial : première étape in_progress, le reste locked */
function buildInitialState(): StepsState {
  return {
    batiment: "in_progress",
    carte: "locked",
    finance: "locked",
    synthese: "locked",
  };
}

/** Délai de debounce pour la sauvegarde Supabase (ms) */
const PERSIST_DEBOUNCE_MS = 500;

/* ──────────────────── hook ──────────────────── */

export interface UseProjectStepsReturn {
  /** État courant des 3 étapes */
  stepsState: StepsState;
  /** Étape actuellement affichée */
  activeStep: StepId;
  /** Naviguer vers une étape (si pas locked) */
  goToStep: (step: StepId) => void;
  /** Valider l'étape courante → passe au step suivant */
  validateStep: () => void;
  /** Marquer les étapes postérieures comme stale (quand on édite une étape déjà validée) */
  invalidateFrom: (step: StepId) => void;
  /** Peut-on cliquer sur un step donné ? */
  canNavigateTo: (step: StepId) => boolean;
  /** L'étape courante est-elle validable ? (= in_progress ou stale) */
  canValidate: boolean;
  /** Peut-on aller au step suivant ? */
  canGoNext: boolean;
  /** Aller au step suivant */
  goNext: () => void;
  /** Aller au step précédent */
  goPrev: () => void;
}

export function useProjectSteps(
  projectId: string,
  initialState?: StepsState | null,
): UseProjectStepsReturn {
  const [stepsState, setStepsState] = useState<StepsState>(() => {
    if (initialState && isValidStepsState(initialState)) {
      return initialState;
    }
    return buildInitialState();
  });

  const [activeStep, setActiveStep] = useState<StepId>(() => {
    if (initialState && isValidStepsState(initialState)) {
      // Première étape non-validated
      for (const sid of STEP_ORDER) {
        if (initialState[sid] !== "validated") return sid;
      }
      // Toutes validées → dernière
      return STEP_ORDER[STEP_ORDER.length - 1]!;
    }
    return "batiment";
  });

  /* ── persistance Supabase (debounced) ── */

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Ne pas sauvegarder au premier rendu (on vient de lire depuis la DB)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveWizardState(projectId, stepsState);
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [stepsState, projectId]);

  /* ── navigation ── */

  const canNavigateTo = useCallback(
    (step: StepId): boolean => {
      const status = stepsState[step];
      return status !== "locked";
    },
    [stepsState],
  );

  const goToStep = useCallback(
    (step: StepId) => {
      if (!canNavigateTo(step)) return;

      setStepsState((prev) => {
        const next = { ...prev };
        // L'utilisateur revient sur une étape validée → mode édition
        if (next[step] === "validated") {
          next[step] = "in_progress";

          // Les étapes postérieures deviennent stale (à revalider)
          const startIdx = indexOf(step) + 1;
          for (let i = startIdx; i < STEP_ORDER.length; i++) {
            const sid = STEP_ORDER[i]!;
            if (next[sid] === "validated") {
              next[sid] = "stale";
            }
          }
        }
        return next;
      });
      setActiveStep(step);
    },
    [canNavigateTo],
  );

  /* ── validation ── */

  const validateStep = useCallback(() => {
    setStepsState((prev) => {
      const next = { ...prev };
      next[activeStep] = "validated";

      // Débloquer l'étape suivante si elle est locked
      const idx = indexOf(activeStep);
      const nextStepId = STEP_ORDER[idx + 1];
      if (nextStepId && next[nextStepId] === "locked") {
        next[nextStepId] = "in_progress";
      }
      return next;
    });

    // Avancer automatiquement à l'étape suivante
    const idx = indexOf(activeStep);
    const nextStepId = STEP_ORDER[idx + 1];
    if (nextStepId) {
      setActiveStep(nextStepId);
    }
  }, [activeStep]);

  /* ── invalidation / stale ── */

  const invalidateFrom = useCallback((step: StepId) => {
    setStepsState((prev) => {
      const next = { ...prev };
      const startIdx = indexOf(step) + 1;
      for (let i = startIdx; i < STEP_ORDER.length; i++) {
        const sid = STEP_ORDER[i]!;
        if (next[sid] === "validated") {
          next[sid] = "stale";
        }
      }
      return next;
    });
  }, []);

  /* ── navigation séquentielle ── */

  const canValidate = useMemo(() => {
    const status = stepsState[activeStep];
    return status === "in_progress" || status === "stale";
  }, [stepsState, activeStep]);

  const canGoNext = useMemo(() => {
    const idx = indexOf(activeStep);
    if (idx >= STEP_ORDER.length - 1) return false;
    return stepsState[activeStep] === "validated";
  }, [stepsState, activeStep]);

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    const idx = indexOf(activeStep);
    const nextId = STEP_ORDER[idx + 1];
    if (nextId) {
      setActiveStep(nextId);
      // Si l'étape suivante est locked, la débloquer
      setStepsState((prev) => {
        if (prev[nextId] === "locked") {
          return { ...prev, [nextId]: "in_progress" };
        }
        return prev;
      });
    }
  }, [canGoNext, activeStep]);

  const goPrev = useCallback(() => {
    const idx = indexOf(activeStep);
    if (idx <= 0) return;
    const prevId = STEP_ORDER[idx - 1];
    if (prevId) {
      goToStep(prevId);
    }
  }, [activeStep, goToStep]);

  return {
    stepsState,
    activeStep,
    goToStep,
    validateStep,
    invalidateFrom,
    canNavigateTo,
    canValidate,
    canGoNext,
    goNext,
    goPrev,
  };
}
