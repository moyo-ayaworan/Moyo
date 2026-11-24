import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, hasAdminSession } from '@/lib/auth';
import FeedbackInbox from '@/components/admin/FeedbackInbox';
export const dynamic = 'force-dynamic';
export const metadata = { title:'Stillbounds app feedback | Admin', robots:{index:false,follow:false} };
export default async function Page() {
  if (!hasAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin/login?next=/admin/stillbounds/feedback');
  return <FeedbackInbox />;
}
