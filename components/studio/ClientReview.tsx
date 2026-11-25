"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  getStorageItem,
  setStorageItem,
  removeStorageItem,
} from "@/lib/browserStorage";
import ClientBookPreview from "./ClientBookPreview";
import ReviewThread from "./ReviewThread";
import ReviewActivity from "./ReviewActivity";
import ReviewReceipts from "./ReviewReceipts";
import ReviewEmailSettings from "./ReviewEmailSettings";
import type {
  ReviewReply,
  ReviewActivityData,
  ApprovalReceipt,
} from "./reviewTypes";
import s from "./studio.module.css";

type Pin = { x: number; y: number };
type Comment = {
  id: string;
  spreadId: string;
  text: string;
  createdAt: string;
  resolved: boolean;
  pin?: Pin | null;
  replies?: ReviewReply[];
};
type Review = {
  id: string;
  title: string;
  version: number;
  expiresAt: number;
  watermark: boolean;
  decision: string;
  spreads: { id: string; width: number; height: number }[];
  comments: Comment[];
  activity?: ReviewActivityData;
  receipts?: ApprovalReceipt[];
};
type Draft = { text: string; pin: Pin | null };
type Saved = { drafts: Record<string, Draft>; seen: string[] };
class ReviewError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
const empty: Saved = { drafts: {}, seen: [] };
const status = (decision: string) =>
  decision === "approved"
    ? "Approved"
    : decision === "changes"
      ? "Changes requested"
      : "Awaiting review";

export default function ClientReview({ id }: { id: string }) {
  const base = "/api/mofolio/studio/reviews/" + id;
  const [review, setReview] = useState<Review>();
  const [code, setCode] = useState("");
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<Saved>(empty);
  const savedRef = useRef<Saved>(empty);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const opening = useRef<{ base: string; promise: Promise<Review> } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);
  const [message, setMessage] = useState("");
  const [pinMode, setPinMode] = useState(false);
  const [filter, setFilter] = useState("all");
  const [approval, setApproval] = useState(false);
  const approvalDialog = useRef<HTMLDialogElement>(null);
  const [history, setHistory] = useState<Review[]>([]);
  const [historyState, setHistoryState] = useState("idle");
  const [historyError, setHistoryError] = useState("");
  const [comparisonId, setComparisonId] = useState("");
  const [comparisonIndex, setComparisonIndex] = useState(0);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [previewError, setPreviewError] = useState(false);
  const [comparisonError, setComparisonError] = useState(false);
  const storageKey = (version: Review) =>
    `stillbounds-review:${version.id}:${version.version}`;
  const api = useCallback(
    async (path: string, method = "GET", data?: unknown) => {
      let response: Response;
      try {
        response = await fetch(base + path, {
          method,
          cache: "no-store",
          headers: data ? { "Content-Type": "application/json" } : undefined,
          body: data ? JSON.stringify(data) : undefined,
        });
      } catch {
        throw new ReviewError(
          "Connection lost. Check your internet connection and try again. Any unsent drafts remain available in this tab.",
          0,
        );
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new ReviewError(
          result.error ||
            "The review service is unavailable. Please try again.",
          response.status,
        );
      return result;
    },
    [base],
  );
  function report(cause: unknown) {
    setError(
      cause instanceof Error
        ? cause.message
        : "Unable to complete this action. Please try again.",
    );
    setErrorStatus(cause instanceof ReviewError ? cause.status : 0);
  }
  function restore(next: Review) {
    let value: Saved = { drafts: {}, seen: [] };
    try {
      const raw = getStorageItem("local", storageKey(next));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.expiresAt > Date.now()) {
          for (const spread of next.spreads) {
            const draft = parsed.drafts?.[spread.id];
            if (draft && typeof draft.text === "string") {
              const pin = draft.pin;
              value.drafts[spread.id] = {
                text: draft.text.slice(0, 2000),
                pin:
                  pin &&
                  Number.isFinite(pin.x) &&
                  Number.isFinite(pin.y) &&
                  pin.x >= 0 &&
                  pin.x <= 1 &&
                  pin.y >= 0 &&
                  pin.y <= 1
                    ? pin
                    : null,
              };
            }
          }
          value.seen = Array.isArray(parsed.seen)
            ? [
                ...new Set<string>(
                  parsed.seen.filter((item: unknown) =>
                    next.spreads.some((spread) => spread.id === item),
                  ),
                ),
              ]
            : [];
        } else removeStorageItem("local", storageKey(next));
      }
    } catch {
      value = { drafts: {}, seen: [] };
    }
    savedRef.current = value;
    setSaved(value);
    setReview(next);
  }
  function persist(next: Saved) {
    savedRef.current = next;
    setSaved(next);
    if (review)
      setStorageAvailable(
        setStorageItem(
          "local",
          storageKey(review),
          JSON.stringify({ ...next, expiresAt: review.expiresAt }),
        ),
      );
  }
  useEffect(() => {
    let active = true;
    if (!opening.current || opening.current.base !== base) {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const access = fragment.get("access");
      if (access) {
        fragment.delete("access");
        window.history.replaceState(
          null,
          "",
          window.location.pathname +
            window.location.search +
            (fragment.size ? `#${fragment}` : ""),
        );
      }
      opening.current = {
        base,
        promise: (async () => {
          if (access) await api("/unlock", "POST", { code: access });
          return api("");
        })(),
      };
    }
    opening.current.promise
      .then((next) => {
        if (active) restore(next);
      })
      .catch((cause) => {
        if (
          active &&
          (!(cause instanceof ReviewError) ||
            cause.status !== 401 ||
            cause.message !== "Enter your private review access code.")
        )
          report(cause);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // Restore once when this review URL changes; drafts are updated synchronously thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, base]);
  useEffect(() => {
    const dialog = approvalDialog.current;
    if (approval && dialog && !dialog.open) dialog.showModal();
    else if (!approval && dialog?.open) dialog.close();
  }, [approval]);
  async function perform(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    setErrorStatus(0);
    try {
      await action();
    } catch (cause) {
      report(cause);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const spread = review?.spreads[index];
  const draft = spread
    ? (saved.drafts[spread.id] ?? { text: "", pin: null })
    : { text: "", pin: null };
  const comments =
    review?.comments.filter((comment) => comment.spreadId === spread?.id) ?? [];
  const unresolved =
    review?.comments.filter((comment) => !comment.resolved).length ?? 0;
  const unseen =
    review?.spreads.filter((page) => !saved.seen.includes(page.id)).length ?? 0;
  const draftCount = Object.values(saved.drafts).filter((value) =>
    value.text.trim(),
  ).length;
  const comparison = history.find((version) => version.id === comparisonId);
  function updateDraft(change: Partial<Draft>) {
    if (!spread) return;
    persist({
      ...savedRef.current,
      drafts: {
        ...savedRef.current.drafts,
        [spread.id]: { ...draft, ...change },
      },
    });
  }
  function viewed(page: number) {
    const pageId = review?.spreads[page]?.id;
    if (pageId && !savedRef.current.seen.includes(pageId))
      persist({
        ...savedRef.current,
        seen: [...savedRef.current.seen, pageId],
      });
  }
  async function loadHistory() {
    setHistoryState("loading");
    setHistoryError("");
    try {
      setHistory(await api("/history"));
      setHistoryState("loaded");
    } catch (cause) {
      setHistoryState("error");
      setHistoryError(
        cause instanceof Error ? cause.message : "Unable to load history.",
      );
    }
  }
  function navigate(next: number) {
    setIndex(next);
    setPinMode(false);
    setPreviewError(false);
  }
  async function decide(decision: string) {
    await api("/decision", "POST", { decision, confirm: true });
    setReview((current) => (current ? { ...current, decision } : current));
    setApproval(false);
    try {
      setReview(await api(""));
    } catch {
      setError(
        "Your decision was saved. Refresh feedback to load your latest status and any approval receipt.",
      );
    }
    setMessage(
      decision === "approved"
        ? "Version approved. Your photographer can see your decision."
        : "Changes requested. Leave comments on the relevant pages so your photographer knows what to adjust.",
    );
  }
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
              Open the private link shared by your photographer, or enter its
              access code.
            </p>
            {errorStatus === 410 ? (
              <p className={s.notice}>
                Ask your photographer for a new private review link.
              </p>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void perform(async () => {
                    await api("/unlock", "POST", { code: code.trim() });
                    restore(await api(""));
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
                  onChange={(event) => setCode(event.target.value)}
                  autoComplete="off"
                  required
                />
                <div className={s.actions}>
                  <button
                    className={`${s.button} ${s.primary}`}
                    disabled={busy}
                  >
                    {busy ? "Opening…" : "Open review"}
                  </button>
                  <button
                    className={s.button}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => restore(await api("")))
                    }
                  >
                    Retry connection
                  </button>
                </div>
              </form>
            )}
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
            <section className={s.panel} aria-labelledby="overview-title">
              <div className={s.overviewHeader}>
                <div>
                  <h2 id="overview-title">Your review at a glance</h2>
                  <p className={s.muted}>
                    {saved.seen.length} of {review.spreads.length} pages viewed
                    · {unresolved} unresolved{" "}
                    {unresolved === 1 ? "comment" : "comments"} · {draftCount}{" "}
                    unsent {draftCount === 1 ? "draft" : "drafts"}
                  </p>
                </div>
                <label>
                  Show pages
                  <select
                    className={s.input}
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  >
                    <option value="all">All pages</option>
                    <option value="feedback">With feedback</option>
                    <option value="unresolved">Unresolved feedback</option>
                    <option value="unseen">Not viewed</option>
                    <option value="drafts">Unsent drafts</option>
                  </select>
                </label>
              </div>
              <nav className={s.thumbnails} aria-label="Review overview">
                {review.spreads.map((page, pageIndex) => {
                  const pageComments = review.comments.filter(
                    (comment) => comment.spreadId === page.id,
                  );
                  const open = pageComments.filter(
                    (comment) => !comment.resolved,
                  ).length;
                  const hasDraft = Boolean(saved.drafts[page.id]?.text.trim());
                  if (
                    (filter === "feedback" && !pageComments.length) ||
                    (filter === "unresolved" && !open) ||
                    (filter === "unseen" && saved.seen.includes(page.id)) ||
                    (filter === "drafts" && !hasDraft)
                  )
                    return null;
                  return (
                    <button
                      key={page.id}
                      className={s.thumbnail}
                      aria-current={index === pageIndex ? "page" : undefined}
                      disabled={busy}
                      onClick={() => navigate(pageIndex)}
                    >
                      <Image
                        unoptimized
                        src={`${base}/media/${pageIndex}`}
                        width={page.width}
                        height={page.height}
                        alt=""
                        loading="lazy"
                      />
                      <strong>Page {pageIndex + 1}</strong>
                      <small>
                        {saved.seen.includes(page.id) ? "Viewed" : "Not viewed"}
                        {pageComments.length
                          ? ` · ${pageComments.length} ${pageComments.length === 1 ? "comment" : "comments"}`
                          : ""}
                        {open ? ` · ${open} unresolved` : ""}
                        {hasDraft ? " · Draft" : ""}
                      </small>
                    </button>
                  );
                })}
              </nav>
              {!review.spreads.some(
                (page) =>
                  filter === "all" ||
                  (filter === "feedback" &&
                    review.comments.some((c) => c.spreadId === page.id)) ||
                  (filter === "unresolved" &&
                    review.comments.some(
                      (c) => c.spreadId === page.id && !c.resolved,
                    )) ||
                  (filter === "unseen" && !saved.seen.includes(page.id)) ||
                  (filter === "drafts" && saved.drafts[page.id]?.text.trim()),
              ) && <p className={s.muted}>No pages match this filter.</p>}
            </section>
            <div className={s.actions}>
              <button
                className={s.button}
                disabled={busy || !spread}
                aria-pressed={pinMode}
                onClick={() => {
                  setPinMode(!pinMode);
                  if (!draft.pin) updateDraft({ pin: { x: 0.5, y: 0.5 } });
                }}
              >
                {pinMode ? "Finish placing pin" : "Pin feedback to the page"}
              </button>
            </div>
            {pinMode && (
              <p className={s.notice}>
                Click a spot on the page, or use the horizontal and vertical
                position controls below. Then write your comment.
              </p>
            )}
            <ClientBookPreview
              key={`${id}:${previewAttempt}`}
              base={base}
              spreads={review.spreads}
              index={index}
              onNavigate={navigate}
              disabled={busy}
              onViewed={viewed}
              pinMode={pinMode}
              selectedPin={draft.pin}
              onPin={(pin) => updateDraft({ pin })}
              pins={comments
                .filter((c) => c.pin)
                .map((c) => ({
                  id: c.id,
                  ...c.pin!,
                  label: `${c.resolved ? "Resolved" : "Unresolved"}: ${c.text}`,
                }))}
              onError={() => setPreviewError(true)}
            />
            {previewError && (
              <div className={s.notice} role="alert">
                This preview could not load. Check your connection and retry. If
                the link has expired, ask your photographer for a new one.
                <div className={s.actions}>
                  <button
                    className={s.button}
                    onClick={() => {
                      setPreviewError(false);
                      setPreviewAttempt((value) => value + 1);
                    }}
                  >
                    Retry preview
                  </button>
                </div>
              </div>
            )}
            <div className={s.feedback}>
              <section className={s.panel}>
                <h2>Feedback on page {index + 1}</h2>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!spread) return;
                    const spreadId = spread.id;
                    void perform(async () => {
                      await api("/comments", "POST", {
                        spreadId,
                        text: draft.text,
                        pin: draft.pin,
                      });
                      const drafts = { ...savedRef.current.drafts };
                      delete drafts[spreadId];
                      persist({ ...savedRef.current, drafts });
                      setPinMode(false);
                      setMessage("Your comment has been saved for this page.");
                      setReview(await api(""));
                    });
                  }}
                >
                  <label className={s.label} htmlFor="comment">
                    What would you like your photographer to adjust?
                  </label>
                  <textarea
                    id="comment"
                    className={s.input}
                    rows={4}
                    value={draft.text}
                    disabled={busy || !spread}
                    onChange={(event) =>
                      updateDraft({ text: event.target.value })
                    }
                    maxLength={2000}
                    required
                    aria-describedby="draft-status"
                  />
                  <p id="draft-status" className={s.muted}>
                    {storageAvailable
                      ? "Drafts are saved on this browser for each page until this review expires."
                      : "Browser storage is unavailable. Keep this tab open to preserve your drafts."}
                  </p>
                  {draft.pin && (
                    <fieldset className={s.pinControls}>
                      <legend>Feedback location</legend>
                      {(["x", "y"] as const).map((axis) => (
                        <label key={axis}>
                          {axis === "x" ? "Horizontal" : "Vertical"}:{" "}
                          {Math.round(draft.pin![axis] * 100)}%
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round(draft.pin![axis] * 100)}
                            disabled={busy}
                            onChange={(event) =>
                              updateDraft({
                                pin: {
                                  ...draft.pin!,
                                  [axis]: Number(event.target.value) / 100,
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                      <button
                        className={s.button}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          updateDraft({ pin: null });
                          setPinMode(false);
                        }}
                      >
                        Remove pin
                      </button>
                    </fieldset>
                  )}
                  <div className={s.actions}>
                    <button
                      className={s.button}
                      disabled={busy || !draft.text.trim() || !spread}
                    >
                      {busy ? "Saving…" : "Send comment"}
                    </button>
                    {(draft.text || draft.pin) && (
                      <button
                        className={s.button}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          updateDraft({ text: "", pin: null });
                          setPinMode(false);
                        }}
                      >
                        Discard draft
                      </button>
                    )}
                  </div>
                </form>
                <button
                  className={s.button}
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      setReview(await api(""));
                      setMessage("Feedback refreshed.");
                    })
                  }
                >
                  Refresh feedback
                </button>
                {!comments.length && (
                  <p className={s.muted}>No feedback on this page yet.</p>
                )}
                {comments.map((comment, i) => (
                  <div className={s.comment} key={comment.id}>
                    <p>
                      {comment.pin && (
                        <strong>
                          Pin{" "}
                          {comments.slice(0, i + 1).filter((c) => c.pin).length}{" "}
                          ·{" "}
                        </strong>
                      )}
                      {comment.text}
                    </p>
                    <small>
                      {comment.resolved
                        ? "Resolved by your photographer"
                        : "Sent to your photographer"}{" "}
                      · {new Date(comment.createdAt).toLocaleDateString()}
                    </small>
                    <ReviewThread
                      commentId={comment.id}
                      replies={comment.replies}
                      actor="client"
                      disabled={busy}
                      onReply={async (text) => {
                        await api(`/comments/${comment.id}/replies`, "POST", {
                          text,
                        });
                        setMessage("Your reply has been saved.");
                        try {
                          setReview(await api(""));
                        } catch {
                          setError(
                            "Your reply was saved. Refresh feedback to see the latest conversation.",
                          );
                        }
                      }}
                    />
                  </div>
                ))}
              </section>
              <section className={s.panel}>
                <h2>Your decision</h2>
                <p className={s.muted}>
                  Current status: {status(review.decision)}.
                </p>
                <p className={s.muted}>
                  Your decision applies to version {review.version}. Approval
                  confirms this preview; your photographer will arrange print or
                  delivery details separately.
                </p>
                <div className={s.actions}>
                  <button
                    className={`${s.button} ${s.primary}`}
                    disabled={busy || !review.spreads.length}
                    onClick={() => setApproval(true)}
                  >
                    Approve this version
                  </button>
                  <button
                    className={s.button}
                    disabled={busy}
                    onClick={() => void perform(() => decide("changes"))}
                  >
                    Request changes
                  </button>
                </div>
                <ReviewReceipts
                  receipts={review.receipts}
                  base={base}
                  decision={review.decision}
                />
                <p className={s.muted}>
                  Keep this private link within your review group. People with
                  access can also compare earlier published versions while those
                  reviews remain available.
                </p>
              </section>
            </div>
            <section className={`${s.panel} ${s.section}`}>
              <ReviewActivity activity={review.activity} />
              <ReviewEmailSettings base={base} decision={review.decision} />
            </section>
            <section
              className={`${s.panel} ${s.section}`}
              aria-labelledby="history-title"
            >
              <h2 id="history-title">Revision history</h2>
              <p className={s.muted}>
                Compare this book with earlier published versions and see which
                requests were resolved. Expired and withdrawn versions are
                unavailable.
              </p>
              <button
                className={s.button}
                disabled={historyState === "loading"}
                onClick={() => void loadHistory()}
              >
                {historyState === "loading"
                  ? "Loading history…"
                  : historyState === "idle"
                    ? "Load revision history"
                    : "Refresh history"}
              </button>
              {historyError && (
                <p className={s.notice} role="alert">
                  {historyError}
                </p>
              )}
              {historyState === "loaded" && !history.length && (
                <p className={s.muted}>
                  There are no earlier published versions available to compare.
                </p>
              )}
              {history.length > 0 && (
                <>
                  <label className={s.label} htmlFor="compare-version">
                    Compare with
                  </label>
                  <select
                    id="compare-version"
                    className={s.input}
                    value={comparisonId}
                    onChange={(event) => {
                      setComparisonId(event.target.value);
                      setComparisonIndex(0);
                      setComparisonError(false);
                    }}
                  >
                    <option value="">Choose an earlier version</option>
                    {history.map((version) => (
                      <option key={version.id} value={version.id}>
                        Version {version.version} · {status(version.decision)} ·{" "}
                        {version.comments.filter((c) => c.resolved).length}{" "}
                        resolved
                      </option>
                    ))}
                  </select>
                </>
              )}
              {comparison && (
                <>
                  <div className={s.comparison}>
                    <div>
                      <h3>Version {comparison.version}</h3>
                      <label className={s.label} htmlFor="compare-page">
                        Earlier page
                      </label>
                      <select
                        id="compare-page"
                        className={s.input}
                        value={comparisonIndex}
                        onChange={(event) => {
                          setComparisonIndex(Number(event.target.value));
                          setComparisonError(false);
                        }}
                      >
                        {comparison.spreads.map((page, i) => (
                          <option key={page.id} value={i}>
                            Page {i + 1}
                          </option>
                        ))}
                      </select>
                      {comparison.spreads[comparisonIndex] && (
                        <Image
                          className={s.compareImage}
                          unoptimized
                          src={`${base}/history/${comparison.id}/media/${comparisonIndex}`}
                          width={comparison.spreads[comparisonIndex].width}
                          height={comparison.spreads[comparisonIndex].height}
                          alt={`Version ${comparison.version}, page ${comparisonIndex + 1}`}
                          onError={() => setComparisonError(true)}
                        />
                      )}
                    </div>
                    <div>
                      <h3>Version {review.version}</h3>
                      <label className={s.label} htmlFor="current-compare-page">
                        Current page
                      </label>
                      <select
                        id="current-compare-page"
                        className={s.input}
                        value={index}
                        disabled={busy}
                        onChange={(event) =>
                          navigate(Number(event.target.value))
                        }
                      >
                        {review.spreads.map((page, i) => (
                          <option key={page.id} value={i}>
                            Page {i + 1}
                          </option>
                        ))}
                      </select>
                      {spread && (
                        <Image
                          className={s.compareImage}
                          unoptimized
                          src={`${base}/media/${index}`}
                          width={spread.width}
                          height={spread.height}
                          alt={`Current version, page ${index + 1}`}
                        />
                      )}
                    </div>
                  </div>
                  {comparisonError && (
                    <p className={s.notice} role="alert">
                      The earlier preview is unavailable. Refresh history to
                      check whether it has expired or been withdrawn.
                    </p>
                  )}
                  <h3>Feedback on earlier page {comparisonIndex + 1}</h3>
                  {comparison.comments
                    .filter(
                      (c) =>
                        c.spreadId === comparison.spreads[comparisonIndex]?.id,
                    )
                    .map((comment) => (
                      <div className={s.comment} key={comment.id}>
                        <p>{comment.text}</p>
                        <small>
                          {comment.resolved
                            ? "Resolved by your photographer"
                            : "Unresolved in this version"}
                          {comment.pin
                            ? ` · Location ${Math.round(comment.pin.x * 100)}%, ${Math.round(comment.pin.y * 100)}%`
                            : ""}
                        </small>
                      </div>
                    ))}
                  {!comparison.comments.some(
                    (c) =>
                      c.spreadId === comparison.spreads[comparisonIndex]?.id,
                  ) && (
                    <p className={s.muted}>No feedback on this earlier page.</p>
                  )}
                </>
              )}
            </section>
            <dialog
              ref={approvalDialog}
              className={s.approvalDialog}
              onCancel={() => setApproval(false)}
              onClose={() => setApproval(false)}
              aria-labelledby="approval-title"
            >
              <h2 id="approval-title">Approve version {review.version}?</h2>
              <p>{review.title}</p>
              <ul>
                <li>
                  {unseen} {unseen === 1 ? "page" : "pages"} not yet viewed on
                  this browser
                </li>
                <li>
                  {unresolved} unresolved{" "}
                  {unresolved === 1 ? "comment" : "comments"}
                </li>
                <li>
                  {draftCount} unsent {draftCount === 1 ? "draft" : "drafts"}
                </li>
              </ul>
              <p>
                Approval confirms this exact version. Unsent drafts are not sent
                with your approval. You can return to the review to check pages
                and send feedback first.
              </p>
              <div className={s.actions}>
                <button
                  className={s.button}
                  disabled={busy}
                  autoFocus
                  onClick={() => setApproval(false)}
                >
                  Return to review
                </button>
                <button
                  className={`${s.button} ${s.primary}`}
                  disabled={busy}
                  onClick={() => void perform(() => decide("approved"))}
                >
                  {busy
                    ? "Saving…"
                    : `Confirm approval of version ${review.version}`}
                </button>
              </div>
              {error && <p role="alert">{error}</p>}
            </dialog>
          </>
        )}
        {error && (
          <div className={s.notice} role="alert">
            {error}
            {review && errorStatus === 401 && (
              <p>
                Enter your code again to renew access. Your drafts remain saved.
                <button
                  className={s.button}
                  onClick={() => {
                    setReview(undefined);
                    setApproval(false);
                  }}
                >
                  Enter access code
                </button>
              </p>
            )}
            {errorStatus === 429 && (
              <p>Please wait a few minutes before trying again.</p>
            )}
          </div>
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
