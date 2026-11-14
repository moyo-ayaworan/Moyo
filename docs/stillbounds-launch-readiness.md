# Stillbounds launch readiness — 10 November 2026

## Implemented and deployed

- Production website and licensing APIs: https://moyo-roan.vercel.app. Deployment dpl_Eakj5Qp3Wj9K9VAJucL4hPjfqHpX is READY.
- Verified shared accounts; trial begins at first app activation, lasts 30 days, then ₦30,000 NGN once. No automatic charge. Two-laptop allowance.
- Dedicated licensing tables applied. Private signing key stays on the server; creator entitlement uses the verified account ID.
- Account billing/device management and privacy disclosures deployed. Live checkout deliberately disabled.
- Actual Paystack test payment independently verified; signed webhook and duplicate fulfilment checked. See stillbounds-paystack-testing.md.
- Native 0.4.19 includes mandatory main-process activation, device-bound signed certificates, offline expiry/grace, clock rollback checks, persistent deactivation and recovery/view-only access.
- Passwords use salted hashes. Desktop credentials and device keys use macOS encrypted storage. Photos, face analysis and project originals remain local; activation uses a pseudonymous device identifier, laptop name and public key.
- Website tests: 105 passing; TypeScript and production build passed. Native tests: 198 passing.

## Remaining before public paid release

- Packaged registration/view-only checks passed for Apple Silicon and Intel under Rosetta; retain archive evidence in native output/stillbounds-0.4.19-*.json.
- Complete Paystack merchant activation and configure live credentials before enabling checkout. Test-mode success is not a real paid sale.
- Sign and notarize final Mac builds, then publish protected downloads with checksums and minimum macOS. Current candidates are unsigned.
- Physical Intel hardware verification remains required; Rosetta checks do not replace it.
- Complete deployed customer email/password-reset and live purchase acceptance checks. Confirm refund/support terms operationally.

Earlier distributed beta builds are not retroactively protected. Registration does not encrypt or delete existing books or photo originals. Offline device revocation takes effect at refresh or certificate expiry. Local file privacy still depends on Mac access controls and disk protection.
