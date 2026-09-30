"use client";

import { useActionState } from "react";
import { loginAction, setupOwnerAction, verifyCodeAction, confirmTotpSetupAction, type FormState } from "@/app/admin/auth-actions";
import { Alert, Field, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(loginAction, undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.error ? (
        <Alert live tone="bad">
          {state.error}
        </Alert>
      ) : null}
      <Field label="Username" htmlFor="username">
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={40}
          defaultValue={state?.username}
          className={inputClass}
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={200} className={inputClass} />
      </Field>
      <SubmitButton className="w-full" pendingText="Checking…">
        Log in
      </SubmitButton>
    </form>
  );
}

export function CodeForm() {
  const [state, action] = useActionState<FormState, FormData>(verifyCodeAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error ? (
        <Alert live tone="bad">
          {state.error}
        </Alert>
      ) : null}
      <Field label="6-digit code" htmlFor="code" hint="Lost your phone? Type one of your recovery codes instead.">
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={20}
          placeholder="123 456"
          className={`${inputClass} text-center font-display text-2xl tracking-[0.3em]`}
        />
      </Field>
      <SubmitButton className="w-full" pendingText="Checking…">
        Continue
      </SubmitButton>
    </form>
  );
}

export function ConfirmTotpForm() {
  const [state, action] = useActionState<FormState, FormData>(confirmTotpSetupAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error ? (
        <Alert live tone="bad">
          {state.error}
        </Alert>
      ) : null}
      <Field label="Code from the app" htmlFor="code">
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={7}
          placeholder="123 456"
          className={`${inputClass} text-center font-display text-2xl tracking-[0.3em]`}
        />
      </Field>
      <SubmitButton className="w-full" pendingText="Checking…">
        Turn on and continue
      </SubmitButton>
    </form>
  );
}

export function SetupOwnerForm() {
  const [state, action] = useActionState<FormState, FormData>(setupOwnerAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error ? (
        <Alert live tone="bad">
          {state.error}
        </Alert>
      ) : null}
      <Field label="Setup token" htmlFor="token" hint="The SETUP_TOKEN value from the server settings.">
        <input id="token" name="token" type="password" autoComplete="off" required className={inputClass} />
      </Field>
      <Field label="Your name" htmlFor="name">
        <input id="name" name="name" autoComplete="name" required maxLength={60} className={inputClass} />
      </Field>
      <Field label="Username" htmlFor="username" hint="Lowercase letters and numbers, e.g. shiva">
        <input id="username" name="username" autoComplete="username" autoCapitalize="none" required maxLength={32} className={inputClass} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters. A short sentence is easy to remember.">
        <input id="password" name="password" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>
      <Field label="Type the password again" htmlFor="confirm">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>
      <SubmitButton className="w-full" pendingText="Creating…">
        Create owner account
      </SubmitButton>
    </form>
  );
}
