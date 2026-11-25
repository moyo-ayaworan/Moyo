"use client";
import { useRef, useState } from "react";
import ReviewThread from "./ReviewThread";
import ReviewActivity from "./ReviewActivity";
import ReviewReceipts from "./ReviewReceipts";
import type {
  ApprovalReceipt,
  ReviewActivityData,
  ReviewReply,
} from "./reviewTypes";
import s from "./studio.module.css";
export type OwnedReview = {
  id: string;
  decision: string;
  state: string;
  notifyOwner?: boolean;
  spreads: { id: string }[];
  activity?: ReviewActivityData;
  receipts?: ApprovalReceipt[];
  comments: {
    id: string;
    spreadId: string;
    text: string;
    resolved: boolean;
    pin?: { x: number; y: number } | null;
    replies?: ReviewReply[];
  }[];
};
export default function OwnerReviewTools({
  review,
  base,
  onRefresh,
}: {
  review: OwnedReview;
  base: string;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [pendingNotifications, setPendingNotifications] = useState<
    boolean | null
  >(null);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function post(path: string, body: object) {
    const response = await fetch(base + path, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok)
      throw Error(result.error || "Could not save this update.");
  }
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
  async function refreshAfterSave() {
    try {
      await onRefresh();
      return true;
    } catch {
      setError(
        "Your update was saved. Refresh this review to see the latest conversation.",
      );
      return false;
    }
  }
  return (
    <details className={s.ownerTools}>
      <summary>Feedback, receipts and activity</summary>
      <div className={s.actions}>
        <button
          type="button"
          className={s.button}
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await onRefresh();
              setPendingNotifications(null);
            })
          }
        >
          Refresh feedback and activity
        </button>
      </div>
      <label className={s.check}>
        <input
          type="checkbox"
          checked={pendingNotifications ?? review.notifyOwner !== false}
          disabled={busy}
          onChange={(event) => {
            const notifyOwner = event.target.checked;
            setPendingNotifications(notifyOwner);
            void run(async () => {
              try {
                await post("/settings", { notifyOwner });
              } catch (cause) {
                setPendingNotifications(null);
                throw cause;
              }
              if (await refreshAfterSave()) setPendingNotifications(null);
              setMessage(
                notifyOwner
                  ? "Photographer notifications enabled for this review."
                  : "Photographer notifications stopped for this review.",
              );
            });
          }}
        />
        Email me about client comments, replies, approvals, and change requests.
      </label>
      <p className={s.activityNote}>
        Notifications go to your verified account email, or the configured
        studio inbox for studio reviews. Delivery failures retry automatically.
      </p>
      <ReviewActivity activity={review.activity} />
      {!review.comments.length && <p>No client feedback yet.</p>}
      {review.comments.map((comment) => (
        <div className={s.comment} key={comment.id}>
          <p>{comment.text}</p>
          <small>
            {comment.resolved ? "Resolved" : "Unresolved"} · Page{" "}
            {Math.max(
              1,
              review.spreads.findIndex((page) => page.id === comment.spreadId) +
                1,
            )}
            {comment.pin
              ? ` · Pin at ${Math.round(comment.pin.x * 100)}% across, ${Math.round(comment.pin.y * 100)}% down`
              : ""}
          </small>
          {!comment.resolved && (
            <div className={s.actions}>
              <button
                type="button"
                className={s.button}
                disabled={busy || review.state !== "published"}
                onClick={() =>
                  void run(async () => {
                    await post(`/comments/${comment.id}/resolve`, {});
                    await refreshAfterSave();
                    setMessage("Feedback marked resolved.");
                  })
                }
              >
                Mark resolved
              </button>
            </div>
          )}
          <ReviewThread
            commentId={comment.id}
            actor="photographer"
            replies={comment.replies}
            disabled={busy || review.state !== "published"}
            onReply={async (text) => {
              await post(`/comments/${comment.id}/replies`, { text });
              setMessage("Your reply has been saved.");
              await refreshAfterSave();
            }}
          />
        </div>
      ))}
      <ReviewReceipts
        receipts={review.receipts}
        decision={review.decision}
        base={base}
      />
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
