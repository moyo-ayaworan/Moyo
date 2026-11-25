import type { ApprovalReceipt } from "./reviewTypes";
import s from "./studio.module.css";
export default function ReviewReceipts({
  receipts = [],
  base,
  decision,
}: {
  receipts?: ApprovalReceipt[];
  base: string;
  decision: string;
}) {
  if (!receipts.length) return null;
  return (
    <section className={s.receipts} aria-label="Approval receipts">
      <h3>Approval receipts</h3>
      <p>
        Save a dated record of the version and its preview fingerprint. Online
        copies are removed when the review expires or is deleted.
      </p>
      {decision !== "approved" && (
        <p>
          The current decision has changed since approval. These receipts remain
          a record of earlier approvals.
        </p>
      )}
      {receipts.map((receipt) => (
        <div key={receipt.id} className={s.receipt}>
          <strong>
            Version {receipt.snapshot.version} · Approved{" "}
            {new Date(receipt.approvedAt).toLocaleString()}
          </strong>
          <small>Receipt {receipt.id}</small>
          <a
            className={s.button}
            href={`${base}/receipts/${receipt.id}`}
            download
          >
            Download approval receipt
          </a>
          <details>
            <summary>Preview fingerprint</summary>
            <code>{receipt.snapshot.previewDigest}</code>
          </details>
        </div>
      ))}
    </section>
  );
}
