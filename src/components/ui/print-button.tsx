"use client";

import { Printer } from "lucide-react";
import { buttonClass, type ButtonSize } from "@/components/ui/button";

export function PrintButton({ label = "Print", size = "lg", className }: { label?: string; size?: ButtonSize; className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("secondary", size, className)}>
      <Printer className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
