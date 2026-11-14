# Paystack test verification — 10 November 2026

A real ₦30,000 NGN test checkout was completed in the creator's browser using Paystack's documented test card. Hosted checkout showed bot protection in the automated browser, so the user completed that step directly. No real card was used by the agent.

Paystack's transaction verification returned success, domain=test, amount=3000000 kobo, NGN and the expected reference. Its Webhook Events API recorded charge.success as Delivered with HTTP 200. The received raw body and signature were encrypted by a temporary receiver holding only a generated public encryption key. They were decrypted and verified locally before invoking the actual BillingService webhook handler against an isolated test schema.

The handler independently verified the transaction with Paystack, fulfilled one test order, left an unrelated account without paid access, rejected an invalid signature, and tolerated a duplicate event without a second purchase. A device-bound paid test certificate validated with the ephemeral test key and was rejected with expected environment=live. This tests backend entitlement and certificate issuance; it does not establish that enforcement is integrated into the packaged desktop app.

Both legacy x-paystack-signature and timestamped Paystack-Signature verification are supported. The latter uses STILLBOUNDS_PAYSTACK_WEBHOOK_SECRET (whsec_), a five-minute timestamp tolerance, and refuses legacy downgrade when a signing secret is configured. Never put a secret in a NEXT_PUBLIC_ variable.

The initial proposal to deploy merchant/database credentials to a new receiver project was rejected by automatic approval review. That credential-bearing deployment did not occur. The alternative receiver contained neither merchant nor database credentials and did no payment processing. Actual application processing ran locally. Production webhook processing remains undeployed.

The temporary Paystack endpoint, temporary Vercel project and isolated database schema were removed after verification. Temporary private keys and captured payload files were deleted. The saved local Paystack test key was preserved in ignored .env.development.local. Live checkout remains disabled. Provider test transaction history remains available in Paystack.

Evidence: output/stillbounds-payment-verification.json. Automated regression suite: 105 passing tests. Production launch still requires persistent backend configuration, authenticated billing UI/device management, desktop licence enforcement, deployment, and verification of that deployed flow.
