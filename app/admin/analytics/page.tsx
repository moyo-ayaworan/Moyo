import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, hasAdminSession } from '@/lib/auth';
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';
export const dynamic='force-dynamic';
export const metadata={title:'Site analytics | Admin',robots:{index:false,follow:false}};
export default async function Page(){if(!hasAdminSession((await cookies()).get(ADMIN_COOKIE)?.value))redirect('/admin/login?next=/admin/analytics');return <AnalyticsDashboard/>;}
