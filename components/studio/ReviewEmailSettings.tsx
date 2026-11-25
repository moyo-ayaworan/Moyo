"use client";
import { useEffect, useRef, useState } from "react";
import s from "./studio.module.css";
type Preferences = { email: string; reminders: boolean } | null;
export default function ReviewEmailSettings({
  base,
  decision,
}: {
  base: string;
  decision: string;
}) {
  const [preferences, setPreferences] = useState<Preferences>(null);
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [reminders, setReminders] = useState(true);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function api(path = "", method = "GET", body?: object) {
    const response = await fetch(base + "/notifications" + path, {
      method,
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok)
      throw Error(data.error || "Review email settings are unavailable.");
    return data;
  }
  useEffect(() => {
    let active = true;
    api()
      .then((value) => {
        if (active) setPreferences(value);
      })
      .catch(() => {
        if (active)
          setError(
            "Could not load email settings. Refresh the page to try again.",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    }; /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [base]);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <section className={s.emailSettings} aria-labelledby="email-settings-title">
      <h2 id="email-settings-title">Review emails</h2>
      <p>
        Get photographer replies and approval receipts by email. You can also
        request one reminder before this link expires. Confirm your address
        first; this does not subscribe you to marketing.
      </p>
      {decision === "approved" && (
        <p>This version is approved, so expiry reminders are stopped.</p>
      )}
      {!ready ? (
        <p role="status">Loading email settings…</p>
      ) : preferences ? (
        <>
          <p>
            Review updates go to <strong>{preferences.email}</strong>.{" "}
            {preferences.reminders
              ? "One expiry reminder is enabled while a decision is pending."
              : "Expiry reminders are off."}
          </p>
          <button
            className={s.button}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api("/stop", "POST", {});
                setPreferences(null);
                setPendingEmail("");
                setMessage("Review emails stopped for this address.");
              })
            }
          >
            Stop review emails
          </button>
        </>
      ) : pendingEmail ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await api("/confirm", "POST", { email: pendingEmail, code });
              setPreferences({
                email: pendingEmail.trim().toLowerCase(),
                reminders,
              });
              setCode("");
              setMessage("Email confirmed. Review updates are enabled.");
            });
          }}
        >
          <p>
            A confirmation email is queued for <strong>{pendingEmail}</strong>.
            Check your inbox and spam folder. Enter its six-digit code within 15
            minutes of requesting it.
          </p>
          <label className={s.label} htmlFor="review-email-code">
            Email confirmation code
          </label>
          <input
            id="review-email-code"
            className={s.input}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
          <div className={s.actions}>
            <button className={s.button} disabled={busy}>
              Confirm email
            </button>
            <button
              className={s.button}
              type="button"
              disabled={busy}
              onClick={() => {
                setPendingEmail("");
                setCode("");
              }}
            >
              Change address or request another code
            </button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await api("", "POST", {
                email: email.trim(),
                reminders,
                consent,
              });
              setPendingEmail(email.trim());
              setMessage(
                "Confirmation requested. Your review feedback remains available here.",
              );
            });
          }}
        >
          <label className={s.label} htmlFor="review-email">
            Your email address
          </label>
          <input
            id="review-email"
            className={s.input}
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label className={s.check}>
            <input
              type="checkbox"
              checked={reminders}
              onChange={(event) => setReminders(event.target.checked)}
            />
            Send one reminder before this review expires.
          </label>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
            />
            I want review updates and approval receipts at this address.
          </label>
          <button className={s.button} disabled={busy || !consent}>
            Send confirmation code
          </button>
        </form>
      )}
      {error && (
        <p className={s.notice} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className={s.notice} role="status">
          {message}
        </p>
      )}
    </section>
  );
}
