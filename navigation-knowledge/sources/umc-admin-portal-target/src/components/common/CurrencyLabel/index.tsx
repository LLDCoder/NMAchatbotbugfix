import type { ReactNode } from "react";
import AED from "@/assets/icons/Aed";

interface CurrencyLabelProps {
  label: ReactNode;
  className?: string;
}

export default function CurrencyLabel({
  label,
  className,
}: CurrencyLabelProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      <span>{label}</span>
      <AED aria-label="AED" style={{ flex: "0 0 auto" }} />
    </span>
  );
}
