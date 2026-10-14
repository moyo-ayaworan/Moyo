"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import s from "./studio.module.css";
type Review = {
  id: string;
  title: string;
  version: number;
  expiresAt: number;
  watermark: boolean;
  decision: string;
  spreads: { id: string; width: number; height: number }[];
  comments: {
    id: string;
    spreadId: string;
    text: string;
    createdAt: string;
    resolved: boolean;
  }[];
};
export default function ClientReview({ id }: { id: string }) {
  const base = "/api/mofolio/studio/reviews/" + id;
  const [review, setReview] = useState<Review>(),
    [code, setCode] = useState(""),
    [index, setIndex] = useState(0),
    [text, setText] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const api = useCallback(
    async (path: string, method = "GET", data?: unknown) => {
      const response = await fetch(base + path, {
        method,
        cache: "no-store",
        headers: data ? { "Content-Type": "application/json" } : undefined,
        body: data ? JSON.stringify(data) : undefined,
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "This review is unavailable.");
      return result;
    },
    [base],
  );
  useEffect(() => {
    let active = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1)),
      access = fragment.get("access");
    if (access) window.history.replaceState(null, "", window.location.pathname);
    (async () => {
      try {
        if (access) await api("/unlock", "POST", { code: access });
        const next = await api("");
        if (active) setReview(next);
      } catch (e) {
        if (active && access)
          setError(e instanceof Error ? e.message : "Unable to open review.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [api]);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to complete this action.",
      );
    } finally {
      setBusy(false);
    }
  }
  const spread = review?.spreads[index];
  return (
    <main className={s.shell}>
      <div className={s.review}>
        <header className={s.top}>
          <span className={s.brand}>
            Moyo <span className={s.muted}>/ Stillbounds</span>
          </span>
          <span className={s.eyebrow}>Private book review</span>
        </header>
        {loading ? (
          <p role="status">Opening your private review…</p>
        ) : !review ? (
          <section className={`${s.panel} ${s.center}`}>
            <p className={s.eyebrow}>Client access</p>
            <h1 className={s.title}>
              Your book,
              <br />
              ready to review.
            </h1>
            <p className={s.muted}>
              Open the private link shared by Moyo, or enter its access code.
              This review is visible only to people with access.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void perform(async () => {
                  await api("/unlock", "POST", { code: code.trim() });
                  setReview(await api(""));
                  setCode("");
                });
              }}
            >
              <label className={s.label} htmlFor="review-code">
                Private access code
              </label>
              <input
                id="review-code"
                className={s.input}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                required
              />
              <div className={s.actions}>
                <button className={`${s.button} ${s.primary}`} disabled={busy}>
                  Open review
                </button>
              </div>
            </form>
          </section>
        ) : (
          <>
            <div className={s.intro}>
              <p className={s.eyebrow}>
                Version {review.version} · {review.spreads.length} review
                surfaces
              </p>
              <h1 className={s.title}>{review.title}</h1>
              <p className={s.muted}>
                Review each page, leave feedback, then approve this version or
                request changes. Available until{" "}
                {new Date(review.expiresAt).toLocaleDateString()}.
              </p>
            </div>
            {spread && (
              <Image
                key={spread.id}
                src={base + "/media/" + index}
                alt={`Book preview ${index + 1} of ${review.spreads.length}`}
                width={spread.width}
                height={spread.height}
                unoptimized
                className={s.preview}
                onError={() =>
                  setError(
                    "This preview is unavailable. The review may have expired or been revoked.",
                  )
                }
              />
            )}
            <nav className={s.navigation} aria-label="Book review pages">
              <button
                className={s.button}
                disabled={index === 0 || busy}
                onClick={() => setIndex((i) => i - 1)}
              >
                ← Previous
              </button>
              <span aria-live="polite">
                {index + 1} / {review.spreads.length}
              </span>
              <button
                className={s.button}
                disabled={index >= review.spreads.length - 1 || busy}
                onClick={() => setIndex((i) => i + 1)}
              >
                Next →
              </button>
            </nav>
            <div className={s.feedback}>
              <section className={s.panel}>
                <h2>Feedback on this page</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!spread) return;
                    void perform(async () => {
                      await api("/comments", "POST", {
                        spreadId: spread.id,
                        text,
                      });
                      setReview(await api(""));
                      setText("");
                      setMessage("Your comment has been saved for this page.");
                    });
                  }}
                >
                  <label className={s.label} htmlFor="comment">
                    What would you like Moyo to adjust?
                  </label>
                  <textarea
                    id="comment"
                    className={s.input}
                    rows={4}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={2000}
                    required
                  />
                  <div className={s.actions}>
                    <button
                      className={s.button}
                      disabled={busy || !text.trim()}
                    >
                      Send comment
                    </button>
                  </div>
                </form>
                {review.comments
                  .filter((c) => c.spreadId === spread?.id)
                  .map((c) => (
                    <div className={s.comment} key={c.id}>
                      <p>{c.text}</p>
                      <small>
                        {c.resolved ? "Resolved by Moyo" : "Sent to Moyo"} ·{" "}
                        {new Date(c.createdAt).toLocaleDateString()}
                      </small>
                    </div>
                  ))}
              </section>
              <section className={s.panel}>
                <h2>Your decision</h2>
                <p className={s.muted}>
                  Current status:{" "}
                  {review.decision === "approved"
                    ? "Approved"
                    : review.decision === "changes"
                      ? "Changes requested"
                      : "Awaiting your review"}
                  .
                </p>
                <p className={s.muted}>
                  Your decision applies to version {review.version} of this
                  book. Approval confirms this preview; Moyo will arrange any
                  print or delivery details separately.
                </p>
                <div className={s.actions}>
                  <button
                    className={`${s.button} ${s.primary}`}
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Approve version ${review.version} of this book?`,
                        )
                      )
                        void perform(async () => {
                          await api("/decision", "POST", {
                            decision: "approved",
                            confirm: true,
                          });
                          setReview(await api(""));
                          setMessage(
                            "Version approved. Your decision has been saved for Moyo.",
                          );
                        });
                    }}
                  >
                    Approve this version
                  </button>
                  <button
                    className={s.button}
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        await api("/decision", "POST", {
                          decision: "changes",
                          confirm: true,
                        });
                        setReview(await api(""));
                        setMessage(
                          "Changes requested. Please leave comments on the relevant pages.",
                        );
                      })
                    }
                  >
                    Request changes
                  </button>
                </div>
                <p className={s.muted}>
                  Review previews can be captured or shared. Keep this private
                  link within your review group.
                </p>
              </section>
            </div>
          </>
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
        <footer className={s.footer}>
          Private previews by Moyo Ayaworan ·{" "}
          <a href="/mofolio/privacy">Privacy</a>
        </footer>
      </div>
    </main>
  );
}
