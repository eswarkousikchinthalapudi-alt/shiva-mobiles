"use client";

import { Check, Copy, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import {
  addMemberAction,
  resetMember2faAction,
  resetMemberPasswordAction,
  setMemberActiveAction,
  setMemberRoleAction,
  type TeamResult,
} from "@/app/admin/(panel)/team/actions";
import type { AdminRole } from "@/db/schema";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Alert, Field, inputClass } from "./ui";

function TempPassword({ username, password }: { username: string; password: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2 rounded-2xl bg-ok-soft p-4 text-ok" role="status">
      <p className="font-semibold">Temporary password for {username}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-surface px-3 py-1.5 font-mono text-lg tracking-wide text-fg">{password}</code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(password);
            setCopied(true);
          }}
          className={buttonClass("secondary", "sm")}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-sm text-fg">
        Tell them this password in person. It is shown only now. At their first login they will set up the authenticator app and choose their own password.
      </p>
    </div>
  );
}

export function AddMemberForm() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", role: "staff" as AdminRole });
  const [result, setResult] = useState<{ username: string; tempPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <div className="space-y-3">
        {result ? <TempPassword username={result.username} password={result.tempPassword} /> : null}
        <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary", "md")}>
          <UserPlus className="h-4 w-4" aria-hidden /> Add a person
        </button>
      </div>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const res = await addMemberAction(form);
          if (res.ok && res.tempPassword) {
            setResult({ username: form.username.trim().toLowerCase(), tempPassword: res.tempPassword });
            setForm({ name: "", username: "", role: "staff" });
            setOpen(false);
          } else if (!res.ok) setError(res.error);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="member-name">
          <input
            id="member-name"
            className={inputClass}
            value={form.name}
            maxLength={60}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </Field>
        <Field label="Username" htmlFor="member-username" hint="Lowercase, e.g. ramesh">
          <input
            id="member-username"
            className={inputClass}
            value={form.username}
            maxLength={32}
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">What can they do?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["staff", "Staff", "Add and sell phones, answer requests. Can't see buying costs or change settings."],
              ["owner", "Owner", "Everything, including costs, settings and the team."],
            ] as const
          ).map(([value, title, text]) => (
            <label
              key={value}
              className="flex cursor-pointer gap-3 rounded-2xl border-2 border-line-strong p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
            >
              <input
                type="radio"
                name="role"
                value={value}
                checked={form.role === value}
                onChange={() => setForm({ ...form, role: value })}
                className="mt-1 h-5 w-5 accent-[var(--brand)]"
              />
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-muted">{text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error ? (
        <Alert live tone="bad">
          {error}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>
          {pending ? "Adding…" : "Add and make a password"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "md")}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type Member = { id: string; username: string; role: AdminRole; isActive: boolean };

export function MemberActions({ member }: { member: Member }) {
  const [confirming, setConfirming] = useState<null | "password" | "2fa" | "active" | "role">(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [temp, setTemp] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<TeamResult>, done: string) =>
    start(async () => {
      const res = await fn();
      setConfirming(null);
      if (res.ok) {
        setMessage({ tone: "ok", text: done });
        setTemp(res.tempPassword ?? null);
      } else setMessage({ tone: "bad", text: res.error });
    });

  const prompts = {
    password: {
      text: `Make a new temporary password for ${member.username}? They will be logged out everywhere.`,
      yes: "Yes, reset password",
      go: () => run(() => resetMemberPasswordAction(member.id), "Password reset."),
    },
    "2fa": {
      text: `Reset 2-step login for ${member.username}? Use this when they lost or changed their phone. They will scan a new QR code at their next login.`,
      yes: "Yes, reset 2-step login",
      go: () => run(() => resetMember2faAction(member.id), "2-step login reset. They will set it up again at their next login."),
    },
    active: {
      text: member.isActive
        ? `Switch off ${member.username}'s account? They will be logged out and can't log in.`
        : `Switch ${member.username}'s account back on?`,
      yes: member.isActive ? "Yes, switch off" : "Yes, switch on",
      go: () => run(() => setMemberActiveAction(member.id, !member.isActive), member.isActive ? "Account switched off." : "Account switched on."),
    },
    role: {
      text:
        member.role === "owner"
          ? `Make ${member.username} staff? They will no longer see costs or settings.`
          : `Make ${member.username} an owner? They will see costs, settings and the team.`,
      yes: member.role === "owner" ? "Yes, make staff" : "Yes, make owner",
      go: () => run(() => setMemberRoleAction(member.id, member.role === "owner" ? "staff" : "owner"), "Role changed."),
    },
  } as const;

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="space-y-2 rounded-2xl bg-surface-2 p-3">
          <p className="text-[0.95rem]">{prompts[confirming].text}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={prompts[confirming].go}
              className={buttonClass(confirming === "active" && member.isActive ? "danger" : "primary", "sm")}
            >
              {pending ? "Please wait…" : prompts[confirming].yes}
            </button>
            <button type="button" onClick={() => setConfirming(null)} className={buttonClass("ghost", "sm")}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {member.isActive ? (
            <>
              <button type="button" onClick={() => setConfirming("password")} className={buttonClass("secondary", "sm")}>
                Reset password
              </button>
              <button type="button" onClick={() => setConfirming("2fa")} className={buttonClass("secondary", "sm")}>
                Reset 2-step login
              </button>
              <button type="button" onClick={() => setConfirming("role")} className={buttonClass("secondary", "sm")}>
                {member.role === "owner" ? "Make staff" : "Make owner"}
              </button>
            </>
          ) : null}
          <button type="button" onClick={() => setConfirming("active")} className={cn(buttonClass("ghost", "sm"), member.isActive && "text-bad")}>
            {member.isActive ? "Switch off" : "Switch on"}
          </button>
        </div>
      )}
      {message ? (
        <Alert live tone={message.tone}>
          {message.text}
        </Alert>
      ) : null}
      {temp ? <TempPassword username={member.username} password={temp} /> : null}
    </div>
  );
}
