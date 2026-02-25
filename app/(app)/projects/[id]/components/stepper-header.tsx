"use client";

import Link from "next/link";
import type { Project, StepId, StepStatus, StepsState, WizardStep } from "@/lib/types/project";
import { WIZARD_STEPS } from "@/lib/types/project";

/* ─── props ─── */

interface StepperHeaderProps {
  project: Project;
  stepsState: StepsState;
  activeStep: StepId;
  onStepClick: (step: StepId) => void;
  onValidate: () => void;
  onNext: () => void;
  onPrev: () => void;
  canNavigateTo: (step: StepId) => boolean;
  canValidate: boolean;
  canGoNext: boolean;
}

/* ─── status → style mapping ─── */

const statusConfig: Record<
  StepStatus,
  {
    ring: string;
    bg: string;
    text: string;
    icon: string;
    label: string;
    labelColor: string;
  }
> = {
  validated: {
    ring: "ring-2 ring-emerald-500",
    bg: "bg-emerald-500",
    text: "text-white",
    icon: "✓",
    label: "Validé",
    labelColor: "text-emerald-600",
  },
  in_progress: {
    ring: "ring-2 ring-blue-500",
    bg: "bg-blue-500",
    text: "text-white",
    icon: "",
    label: "En cours",
    labelColor: "text-blue-600",
  },
  locked: {
    ring: "ring-1 ring-gray-300",
    bg: "bg-gray-200",
    text: "text-gray-400",
    icon: "🔒",
    label: "Verrouillé",
    labelColor: "text-gray-400",
  },
  stale: {
    ring: "ring-2 ring-amber-400",
    bg: "bg-amber-400",
    text: "text-white",
    icon: "⟳",
    label: "À revalider",
    labelColor: "text-amber-600",
  },
};

/* ─── status labels for project ─── */

const projectStatusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700" },
  submitted: { label: "Soumis", color: "bg-blue-100 text-blue-700" },
  accepted: { label: "Accepté", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Refusé", color: "bg-red-100 text-red-700" },
  returned: { label: "Retourné", color: "bg-amber-100 text-amber-700" },
};

/* ═══════════════════════════════════════════════════════════════════ */

export function StepperHeader({
  project,
  stepsState,
  activeStep,
  onStepClick,
  onValidate,
  onNext,
  onPrev,
  canNavigateTo,
  canValidate,
  canGoNext,
}: StepperHeaderProps) {
  const activeIndex = WIZARD_STEPS.findIndex((s) => s.id === activeStep);
  const status = projectStatusLabels[project.status] ?? {
    label: "Inconnu",
    color: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-sm">
      {/* ── Single row : Info + Stepper + Actions ── */}
      <div className="flex items-center justify-between px-8 py-2">
        {/* Left: retour + projet info */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/projects"
            className="text-gray-400 hover:text-gray-600 transition text-sm mr-1"
            title="Retour aux projets"
          >
            ←
          </Link>
          <h1 className="text-base font-bold text-gray-900">{project.name}</h1>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${status.color}`}
          >
            {status.label}
          </span>
          <span className="text-xs text-gray-400">
            {project.mode === "PRO_SERVICE" ? "Pro" : "Self-Service"}
          </span>
        </div>

        {/* Center: stepper */}
        <div className="flex items-center gap-0">
          {WIZARD_STEPS.map((step, idx) => (
            <StepItem
              key={step.id}
              step={step}
              status={stepsState[step.id]}
              isActive={step.id === activeStep}
              isLast={idx === WIZARD_STEPS.length - 1}
              canClick={canNavigateTo(step.id)}
              onClick={() => onStepClick(step.id)}
            />
          ))}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {activeIndex > 0 && (
            <button
              type="button"
              onClick={onPrev}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-[0.97]"
            >
              ← Précédent
            </button>
          )}
          {canValidate && (
            <button
              type="button"
              onClick={onValidate}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.97]"
            >
              ✓ Valider l&apos;étape
            </button>
          )}
          {activeIndex < WIZARD_STEPS.length - 1 && (
            <button
              type="button"
              onClick={onNext}
              disabled={!canGoNext}
              className={`rounded-lg px-5 py-2 text-sm font-semibold shadow-sm transition active:scale-[0.97] ${
                canGoNext
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "cursor-not-allowed bg-gray-200 text-gray-400"
              }`}
            >
              Suivant →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */

function StepItem({
  step,
  status,
  isActive,
  isLast,
  canClick,
  onClick,
}: {
  step: WizardStep;
  status: StepStatus;
  isActive: boolean;
  isLast: boolean;
  canClick: boolean;
  onClick: () => void;
}) {
  const cfg = statusConfig[status];
  const isLocked = status === "locked";

  return (
    <div className="flex items-center">
      {/* step pill */}
      <button
        type="button"
        disabled={!canClick}
        onClick={onClick}
        className={`group flex items-center gap-2.5 rounded-full px-4 py-2 transition-all ${
          canClick ? "cursor-pointer" : "cursor-not-allowed"
        } ${
          isActive
            ? "bg-blue-50 shadow-inner ring-2 ring-blue-500"
            : "hover:bg-gray-50"
        }`}
      >
        {/* circle number / icon */}
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${cfg.ring} ${cfg.bg} ${cfg.text}`}
        >
          {status === "validated"
            ? cfg.icon
            : status === "stale"
              ? cfg.icon
              : status === "locked"
                ? ""
                : step.index + 1}
        </span>

        {/* label + sub-label */}
        <span className="flex flex-col text-left leading-tight">
          <span
            className={`text-sm font-semibold ${
              isActive
                ? "text-blue-700"
                : isLocked
                  ? "text-gray-400"
                  : "text-gray-700"
            }`}
          >
            {step.label}
          </span>
          <span className={`text-[11px] ${cfg.labelColor}`}>{cfg.label}</span>
        </span>
      </button>

      {/* connector line */}
      {!isLast && (
        <div className="mx-1 h-0.5 w-10 flex-shrink-0">
          <div
            className={`h-full rounded-full transition-colors ${
              status === "validated" ? "bg-emerald-400" : "bg-gray-200"
            }`}
          />
        </div>
      )}
    </div>
  );
}
