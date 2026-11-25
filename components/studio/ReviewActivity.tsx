import type { ReviewActivityData } from "./reviewTypes";
import s from "./studio.module.css";
const labels: Record<string, string> = {
  opened: "Client opened the review",
  comment: "Client left feedback",
  reply: "Reply added",
  resolved: "Feedback marked resolved",
  approved: "Version approved",
  changes: "Changes requested",
  reminder_sent: "Expiry reminder sent",
};
const date = (value: string) => new Date(value).toLocaleString();
export default function ReviewActivity({
  activity,
}: {
  activity?: ReviewActivityData;
}) {
  return (
    <details className={s.activity}>
      <summary>Review activity</summary>
      <p>
        {activity?.firstOpenedAt
          ? `First opened ${date(activity.firstOpenedAt)}`
          : "This review has not been opened yet."}
      </p>
      {activity?.lastOpenedAt && (
        <p>
          Last opened {date(activity.lastOpenedAt)} · {activity.openCount}{" "}
          {activity.openCount === 1 ? "visit" : "visits"}
        </p>
      )}
      {activity?.lastFeedbackAt && (
        <p>Last feedback change {date(activity.lastFeedbackAt)}</p>
      )}
      <p className={s.activityNote}>
        Visits are grouped into 30-minute sessions. Activity identifies clients
        by their private review access, rather than by name.
      </p>
      {!!activity?.events.length && (
        <ol className={s.timeline}>
          {activity.events.map((event) => (
            <li key={event.id}>
              <span>
                {labels[event.kind] || "Review updated"}
                {event.kind === "reply"
                  ? ` by ${event.actor === "photographer" ? "your photographer" : "a client"}`
                  : ""}
              </span>
              <time dateTime={event.createdAt}>{date(event.createdAt)}</time>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
