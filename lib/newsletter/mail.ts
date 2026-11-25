import nodemailer from 'nodemailer';
export function newsletterOrigin() {
  const url = new URL(process.env.PAYMENT_ORIGIN || process.env.STILLBOUNDS_BILLING_ORIGIN || 'https://moyo-roan.vercel.app');
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Newsletter origin is not configured.');
  return url.origin;
}
export function newsletterTransport() {
  const user = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER || process.env.EMAIL_USER || process.env.MAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD || process.env.EMAIL_PASS || process.env.MAIL_PASS || process.env.SMTP_PASSWORD;
  const host = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST || process.env.EMAIL_HOST || process.env.MAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || process.env.EMAIL_PORT || process.env.MAIL_PORT || 587);
  const secureValue = process.env.SMTP_SECURE || process.env.EMAIL_SECURE || process.env.MAIL_SECURE;
  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.EMAIL_FROM || user;
  if (!user || !pass || !from) throw Error('Newsletter email is not configured.');
  return { from, mail: nodemailer.createTransport({
    ...(host ? {host,port,secure:secureValue ? secureValue.toLowerCase()==='true' : port===465} : {service:'gmail'}),
    auth:{user,pass},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000,
  }) };
}
