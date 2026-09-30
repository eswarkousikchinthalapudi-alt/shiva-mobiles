"use client";

import { useActionState, useState } from "react";
import { changePasswordAction, newRecoveryCodesAction, resetMyAuthenticatorAction, type SecurityFormState } from "@/app/admin/(panel)/security/actions";
import { buttonClass } from "@/components/ui/button";
import { Alert, Field, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";

export function ChangePasswordForm({ username }: { username: string }) {
  const [state, action] = useActionState<SecurityFormState, FormData>(changePasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {/* Lets password managers save the new password against the right account. */}
      <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
      {state?.error ? (
        <Alert live tone="bad">
          {state.error}
        </Alert>
      ) : null}
      <Field label="Current password" htmlFor="current">
        <input id="current" name="current" type="password" autoComplete="current-password" required maxLength={200} className={inputClass} />
      </Field>
      <Field label="New password" htmlFor="password" hint="At least 10 characters. A short sentence is easy to remember and hard to guess.">
        <input id="password" name="password" type="password" autoComplete="new-password" required maxLength={200} className={inputClass} />
      </Field>
      <Field label="Type the new password again" htmlFor="confirm">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required maxLength={200} className={inputClass} />
      </Field>
      <SubmitButton pendingText="Saving…">Change password</SubmitButton>
    </form>
  );
}

/** A button that asks for the current password before a sensitive change. */
function PasswordGate({
  action,
  label,
  confirmLabel,
  text,
  variant = "secondary",
}: {
  action: (prev: SecurityFormState, formData: FormData) => Promise<SecurityFormState>;
  label: string;
  confirmLabel: string;
  text: string;
  variant?: "secondary" | "danger";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<SecurityFormState, FormData>(action, undefined);
  const id = `gate-${label.replace(/\W+/g, "-").toLowerCase()}`;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass(variant === "danger" ? "secondary" : variant, "md")}>
        {label}
      </button>
    );
  }
  return (
    <form action={formAction} className="w-full space-y-3 rounded-2xl bg-surface-2 p-4">
      <p className="text-[0.95rem]">{text}</p>
      {state?.error ? (
        <Alert live tone="bad">
          {state.error}
        </Alert>
      ) : null}
      <Field label="Your current password" htmlFor={id}>
        <input id={id} name="current" type="password" autoComplete="current-password" required maxLength={200} className={inputClass} autoFocus />
      </Field>
      <Field label="6-digit code from the app" htmlFor={`${id}-code`} hint="Lost your phone? Type a recovery code instead.">
        <input id={`${id}-code`} name="code" inputMode="text" autoComplete="one-time-code" required maxLength={20} className={inputClass} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton size="md" variant={variant === "danger" ? "danger" : "primary"} pendingText="Please wait…">
          {confirmLabel}
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "md")}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function NewRecoveryCodesButton() {
  return (
    <PasswordGate
      action={newRecoveryCodesAction}
      label="Make new recovery codes"
      confirmLabel="Make new codes"
      text="Your old recovery codes will stop working. You will see the new ones once, so keep paper ready."
    />
  );
}

export function ResetAuthenticatorButton() {
  return (
    <PasswordGate
      action={resetMyAuthenticatorAction}
      label="Set up on a new phone"
      confirmLabel="Start again"
      variant="danger"
      text="Use this if you changed or lost your phone. Your old authenticator and recovery codes stop working, and you will scan a new QR code right away."
    />
  );
}
