"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import s from "./studio.module.css";
type Device = {
  id: string;
  label: string;
  created_at: string;
  expires_at: string;
  revoked: boolean;
};
type Version = {
  id: string;
  title: string;
  version: number;
  state: string;
  decision: string;
  expires_at: string;
};
type Summary = {
  devices: Device[];
  versions: Version[];
  bytes: number;
  quota: number;
};
const base = "/api/mofolio/studio";
async function api(path: string, method = "GET", data?: unknown) {
  const response = await fetch(base + path, {
    method,
    cache: "no-store",
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw Error(result.error || "Unable to connect to Moyo Studio.");
  return result;
}
export default function MoyoStudio() {
  const [summary, setSummary] = useState<Summary>(),
    [code, setCode] = useState(""),
    [confirm, setConfirm] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [origin, setOrigin] = useState("");
  const refresh = useCallback(async () => {
    setSummary(await api("/owner"));
  }, []);
  useEffect(() => {
    setOrigin(window.location.origin);
    refresh().catch((e) => setError(e.message));
  }, [refresh]);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to complete this action.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={s.shell}>
      <div className={s.inner}>
        <header className={s.top}>
          <span className={s.brand}>
            Stillbounds <span className={s.muted}>/ Moyo</span>
          </span>
          <Link href="/admin">Back to admin</Link>
        </header>
        <div className={s.intro}>
          <p className={s.eyebrow}>Your private workspace</p>
          <h1 className={s.title}>Moyo Studio</h1>
          <p className={s.muted}>
            Connect your own Stillbounds app to Moyo. Publish selected book
            previews for your clients, collect feedback, and manage which
            devices can use this connection.
          </p>
        </div>
        <div className={s.grid}>
          <section className={s.panel}>
            <h2>Connect your Mac</h2>
            <ol className={s.muted}>
              <li>
                Open <strong>Share for review</strong> in Stillbounds.
              </li>
              <li>
                Enter this website address and choose{" "}
                <strong>Connect website</strong>.
              </li>
              <li>Enter the code displayed in your app below.</li>
              <li>
                After approval, choose <strong>Finish connecting</strong> in the
                app.
              </li>
            </ol>
            <code className={s.address}>
              {origin || "Loading website address…"}
            </code>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void perform(async () => {
                  await api("/owner/approve", "POST", {
                    userCode: code.replace(/[\s-]/g, "").toUpperCase(),
                    confirm,
                  });
                  setMessage(
                    "Device approved. Return to Stillbounds and choose Finish connecting.",
                  );
                  setCode("");
                  setConfirm(false);
                });
              }}
            >
              <label className={s.label} htmlFor="pair-code">
                Code from your Stillbounds app
              </label>
              <input
                className={`${s.input} ${s.code}`}
                id="pair-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={12}
                autoComplete="off"
                placeholder="A1B2C3D4E5"
                required
              />
              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                  required
                />
                <span>
                  I started this connection on my own Mac and the code matches
                  my app.
                </span>
              </label>
              <button
                className={`${s.button} ${s.primary}`}
                disabled={busy || !confirm || !code}
              >
                Approve my device
              </button>
            </form>
          </section>
          <section className={s.panel}>
            <h2>Made for your studio</h2>
            <p className={s.muted}>
              Your Moyo connection is available only through this admin area and
              devices you explicitly approve. Public beta users cannot connect
              to your workspace.
            </p>
            <p className={s.muted}>
              Publishing sends flattened review JPEGs, the book title, and
              review identifiers. Original photos, editable books, and print
              exports stay on your Mac.
            </p>
            <p className={s.muted}>
              Each client link opens one fixed version. Links expire after your
              chosen retention period. Revoke a review to remove its previews
              immediately.
            </p>
            <p className={s.muted}>
              Only approve a code you requested yourself. Never approve a code
              someone sends you.
            </p>
            {summary && (
              <p className={s.eyebrow}>
                {(summary.bytes / 1048576).toFixed(1)} /{" "}
                {Math.round(summary.quota / 1048576)} MiB review storage
              </p>
            )}
          </section>
        </div>
        {message && (
          <p className={s.notice} role="status">
            {message}
          </p>
        )}
        {error && (
          <p className={s.notice} role="alert">
            {error}
          </p>
        )}
        <section className={s.section}>
          <h2>Connected devices</h2>
          {!summary && !error && <p role="status">Loading your studio…</p>}
          {summary?.devices.map((d) => (
            <div className={s.row} key={d.id}>
              <div>
                <strong>{d.label}</strong>
                <small>
                  Connected {new Date(d.created_at).toLocaleDateString()} ·{" "}
                  {d.revoked
                    ? "Revoked"
                    : new Date(d.expires_at).getTime() < Date.now()
                      ? "Expired"
                      : `Expires ${new Date(d.expires_at).toLocaleDateString()}`}
                </small>
              </div>
              {!d.revoked && (
                <button
                  className={s.button}
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await api("/owner/devices/" + d.id, "DELETE");
                      setMessage(
                        "Device access revoked. This Mac must connect again to publish or refresh reviews.",
                      );
                    })
                  }
                >
                  Revoke device
                </button>
              )}
            </div>
          ))}
          {summary?.devices.length === 0 && (
            <p className={s.empty}>
              No connected devices yet. Start with the code from your app.
            </p>
          )}
        </section>
        <section className={s.section}>
          <h2>Client book reviews</h2>
          {summary?.versions.map((v) => (
            <div className={s.row} key={v.id}>
              <div>
                <strong>
                  {v.title} · Version {v.version}
                </strong>
                <small>
                  {v.state === "draft"
                    ? "Uploading"
                    : v.state === "revoked"
                      ? "Revoked"
                      : v.decision === "approved"
                        ? "Client approved"
                        : v.decision === "changes"
                          ? "Changes requested"
                          : "Awaiting client review"}{" "}
                  · Expires {new Date(v.expires_at).toLocaleDateString()}
                </small>
              </div>
              <div className={s.actions}>
                {v.state === "published" && (
                  <button
                    className={s.button}
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        const review = await api("/owner/versions/" + v.id);
                        await navigator.clipboard.writeText(review.url);
                        setMessage(
                          "Private client link copied. Anyone with this link can review this version; share it only with your client.",
                        );
                      })
                    }
                  >
                    Copy client link
                  </button>
                )}
                {v.state !== "revoked" && (
                  <button
                    className={s.button}
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Revoke this review and permanently remove its uploaded previews?",
                        )
                      )
                        void perform(async () => {
                          await api("/owner/versions/" + v.id, "DELETE");
                          setMessage("Review revoked and previews removed.");
                        });
                    }}
                  >
                    Revoke review
                  </button>
                )}
              </div>
            </div>
          ))}
          {summary?.versions.length === 0 && (
            <p className={s.empty}>
              Published previews will appear here after you share a book from
              Stillbounds.
            </p>
          )}
        </section>
        <footer className={s.footer}>
          Moyo Studio · Private owner connection ·{" "}
          <Link href="/mofolio/privacy">Privacy</Link>
        </footer>
      </div>
    </main>
  );
}
