"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useId, useRef } from "react";

type ConfirmationDialogTone = "primary" | "warning" | "danger";

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: string;
  detail?: string;
  reference?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmationDialogTone;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const toneIcons = {
  primary: CheckCircle2,
  warning: AlertTriangle,
  danger: Trash2,
};

export function ConfirmationDialog({
  open,
  title,
  description,
  detail,
  reference,
  confirmLabel,
  cancelLabel = "Retour",
  tone = "primary",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const Icon = toneIcons[tone];

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isLoading) {
        onCancel();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isLoading, onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="tata-confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`tata-confirm-dialog ${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <button
          type="button"
          className="tata-confirm-close"
          aria-label="Fermer"
          disabled={isLoading}
          onClick={onCancel}
        >
          <X size={17} strokeWidth={2} aria-hidden="true" />
        </button>

        <span className="tata-confirm-icon" aria-hidden="true">
          <Icon size={22} strokeWidth={1.9} />
        </span>

        {reference ? (
          <span className="tata-confirm-reference">{reference}</span>
        ) : null}

        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>

        {detail ? (
          <div className="tata-confirm-detail">
            <AlertTriangle size={15} strokeWidth={2} aria-hidden="true" />
            <span>{detail}</span>
          </div>
        ) : null}

        <div className="tata-confirm-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="tata-confirm-cancel"
            disabled={isLoading}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="tata-confirm-submit"
            disabled={isLoading}
            aria-busy={isLoading || undefined}
            onClick={onConfirm}
          >
            {isLoading ? "Traitement..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
