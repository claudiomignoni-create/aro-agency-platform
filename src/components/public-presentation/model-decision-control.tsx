"use client";

import type { PublicPresentationDecision } from "@/lib/communications/data";

const options: Array<{ label: string; value: PublicPresentationDecision }> = [
  { label: "Yes", value: "yes" },
  { label: "Maybe", value: "maybe" },
  { label: "No", value: "no" }
];

export function ModelDecisionControl({
  decision,
  disabled,
  onChange
}: {
  decision?: PublicPresentationDecision;
  disabled: boolean;
  onChange: (decision: PublicPresentationDecision) => void;
}) {
  return (
    <div aria-label="Model decision" className="aro-public-decision" role="group">
      {options.map((option) => (
        <button
          aria-pressed={decision === option.value}
          className={`aro-public-decision-option ${option.value}`}
          disabled={disabled}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          <span aria-hidden="true">
            {option.value === "yes" ? "✓" : option.value === "maybe" ? "?" : "×"}
          </span>
          {option.label}
        </button>
      ))}
    </div>
  );
}
