// Server startup only. Never import this module into client components.
export function applyStudioMailEnvironment(env: Record<string, string | undefined>): boolean {
  const password = env.MOYO_GMAIL_APP_PASSWORD?.replace(/\s/g, '');
  if (!password || !/^[a-zA-Z0-9]{16}$/.test(password)) return false;
  const email = 'moyoayaworan@gmail.com';
  for (const key of ['SMTP_USER', 'EMAIL_SERVER_USER', 'EMAIL_USER', 'MAIL_USER', 'SMTP_FROM', 'MAIL_FROM', 'EMAIL_FROM', 'SMTP_REPLY_TO', 'CONTACT_EMAIL', 'OPERATIONS_ALERT_TO']) env[key] = email;
  for (const key of ['SMTP_PASS', 'EMAIL_SERVER_PASSWORD', 'EMAIL_PASS', 'MAIL_PASS', 'SMTP_PASSWORD']) env[key] = password;
  for (const key of ['SMTP_HOST', 'EMAIL_SERVER_HOST', 'EMAIL_HOST', 'MAIL_HOST']) env[key] = 'smtp.gmail.com';
  for (const key of ['SMTP_PORT', 'EMAIL_SERVER_PORT', 'EMAIL_PORT', 'MAIL_PORT']) env[key] = '465';
  for (const key of ['SMTP_SECURE', 'EMAIL_SECURE', 'MAIL_SECURE']) env[key] = 'true';
  return true;
}
