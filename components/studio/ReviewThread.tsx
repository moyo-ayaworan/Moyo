"use client";
import { useRef, useState } from "react";
import type { ReviewReply } from "./reviewTypes";
import s from "./studio.module.css";
export default function ReviewThread({
  commentId,
  replies = [],
  actor,
  onReply,
  disabled = false,
}: {
  commentId: string;
  replies?: ReviewReply[];
  actor: "client" | "photographer";
  onReply: (text: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  return (
    <div className={s.thread}>
      {replies.map((reply) => (
        <div className={s.reply} key={reply.id}>
          <strong>
            {reply.actor === "photographer" ? "Photographer" : "Client"}
          </strong>
          <p>{reply.text}</p>
          <time dateTime={reply.createdAt}>
            {new Date(reply.createdAt).toLocaleString()}
          </time>
        </div>
      ))}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (lock.current) return;
          lock.current = true;
          setSending(true);
          setError("");
          try {
            await onReply(text);
            setText("");
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Unable to save reply. Please try again.",
            );
          } finally {
            setSending(false);
            lock.current = false;
          }
        }}
      >
        <label className={s.label} htmlFor={`reply-${commentId}`}>
          {actor === "photographer"
            ? "Reply to your client"
            : "Reply in this conversation"}
        </label>
        <textarea
          id={`reply-${commentId}`}
          className={s.input}
          rows={2}
          maxLength={2000}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={sending || disabled}
          required
        />
        <div className={s.actions}>
          <button
            className={s.button}
            disabled={sending || disabled || !text.trim()}
          >
            {sending ? "Saving reply…" : "Send reply"}
          </button>
        </div>
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
