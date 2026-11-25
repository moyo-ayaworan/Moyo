"use client";
import { useState } from "react";
import { useBrowserLocation } from "@/lib/useBrowserLocation";
import s from "@/components/studio/studio.module.css";
export default function ReviewEmailPreferences() {
  const href = useBrowserLocation();
  const fragment = new URLSearchParams(href ? new URL(href).hash.slice(1) : "");
  const review = fragment.get("review"),
    token = fragment.get("token");
  const capability = review && token ? { review, token } : null;
  const ready = Boolean(href);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className={s.shell}>
      <section className={`${s.panel} ${s.center}`}>
        <p className={s.eyebrow}>Stillbounds · Review emails</p>
        <h1 className={s.title}>
          {done ? "Emails stopped." : "Stop review emails?"}
        </h1>
        {!ready ? (
          <p role="status">Opening email preferences…</p>
        ) : done ? (
          <p role="status">
            You will no longer receive replies, receipts, or expiry reminders
            for this review at this address. Your feedback and approval are
            unchanged.
          </p>
        ) : capability ? (
          <>
            <p>
              This stops email updates for the subscription in your link. It
              does not change your review feedback or decision.
            </p>
            <button
              className={`${s.button} ${s.primary}`}
              disabled={busy}
              onClick={async () => {
                if (!capability || busy) return;
                setBusy(true);
                setError("");
                try {
                  const response = await fetch(
                    `/api/mofolio/studio/reviews/${encodeURIComponent(capability.review)}/unsubscribe`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ token: capability.token }),
                    },
                  );
                  const data = await response.json();
                  if (!response.ok)
                    throw Error(data.error || "Please try again.");
                  window.history.replaceState(
                    null,
                    "",
                    window.location.pathname,
                  );
                  setDone(true);
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Unable to stop emails. Please try again.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : "Stop review emails"}
            </button>
          </>
        ) : (
          <p>Open the complete email preference link from a review email.</p>
        )}
        {error && (
          <p className={s.notice} role="alert">
            {error}
          </p>
        )}
        <footer className={s.footer}>
          <a href="/stillbounds/privacy">Privacy</a>
        </footer>
      </section>
    </main>
  );
}
