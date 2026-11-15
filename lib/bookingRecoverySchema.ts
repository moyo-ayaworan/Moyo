export const bookingRecoverySchema = `
  CREATE TABLE IF NOT EXISTS booking_recovery_outbox (
    id TEXT PRIMARY KEY, booking_reference BIGINT NOT NULL, email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), sent_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ, lease TEXT, attempts INT NOT NULL DEFAULT 0,
    admitted_at TIMESTAMPTZ, discarded BOOLEAN NOT NULL DEFAULT FALSE
  );
  CREATE INDEX IF NOT EXISTS booking_recovery_pending_idx
    ON booking_recovery_outbox(created_at) WHERE sent_at IS NULL AND discarded=FALSE;
`;
