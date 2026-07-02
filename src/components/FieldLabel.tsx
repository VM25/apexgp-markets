import React from "react";

interface FieldLabelProps {
  children: React.ReactNode;
  /** Element to render as. Defaults to a block-level span. */
  as?: React.ElementType;
  className?: string;
  title?: string;
}

/**
 * Institutional eyebrow label: 12px, uppercase, wide tracking, slate-500.
 * Replaces the 80+ ad-hoc tiny label spans across the terminal.
 */
export default function FieldLabel({
  children,
  as: Component = "span",
  className = "",
  title,
}: FieldLabelProps) {
  return (
    <Component
      title={title}
      className={`block text-label uppercase tracking-wide font-bold text-slate-500 ${className}`}
    >
      {children}
    </Component>
  );
}
