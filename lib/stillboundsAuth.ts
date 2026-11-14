import { createHmac } from 'node:crypto';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { bearer, deviceAuthorization } from 'better-auth/plugins';

let instance: ReturnType<typeof createStillboundsAuth> | undefined;

function createAuth() {
  const key = process.env.STILLBOUNDS_AUTH_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!key || !process.env.DATABASE_URL) throw new Error('Stillbounds accounts are not configured.');
  const url = new URL(process.env.DATABASE_URL);
  if (url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'verify-full');
  url.searchParams.delete('uselibpqcompat');
  const origin = process.env.STILLBOUNDS_AUTH_URL || 'https://moyo-roan.vercel.app';
  const email = async (to: string, subject: string, link: string) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) throw new Error('Account email is not configured.');
    const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
    await transport.sendMail({ from: process.env.EMAIL_USER, to, subject, text: `${subject}\n\n${link}\n\nIf you did not request this, ignore this email.` });
  };
  return createStillboundsAuth({ origin, key, email, database: new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true }, max: 3 }) });
}

export function createStillboundsAuth({origin, key, database, email}: {
  origin: string; key: string; database: BetterAuthOptions['database'];
  email: (to: string, subject: string, link: string) => Promise<void>;
}) {
  return betterAuth({
    appName: 'Stillbounds', baseURL: origin, basePath: '/api/stillbounds/auth',
    secret: createHmac('sha256', key).update('stillbounds-accounts-v1').digest('hex'),
    database,
    user: { modelName: 'stillbounds_auth_user' },
    session: { modelName: 'stillbounds_auth_session', expiresIn: 60 * 60 * 24 * 30 },
    account: { modelName: 'stillbounds_auth_account' },
    verification: { modelName: 'stillbounds_auth_verification' },
    emailAndPassword: {
      enabled: true, minPasswordLength: 12, maxPasswordLength: 128, requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => email(user.email, 'Reset your Stillbounds password', url),
    },
    emailVerification: {
      sendOnSignUp: true, autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => email(user.email, 'Verify your Stillbounds email', url),
    },
    rateLimit: { enabled: true, storage: 'database', modelName: 'stillbounds_auth_rate_limit' },
    advanced: { cookiePrefix: 'stillbounds-account' },
    plugins: [bearer(), deviceAuthorization({
      verificationUri: `${origin}/mofolio/account`, expiresIn: '10m', interval: '5s',
      validateClient: (clientId) => clientId === 'stillbounds-desktop',
      schema: { deviceCode: { modelName: 'stillbounds_auth_device_code' } },
    })],
  });
}

export function stillboundsAuth() { return instance ??= createAuth(); }
