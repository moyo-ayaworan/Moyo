import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE,hasAdminSession } from '@/lib/auth';
import ShopTools from '@/components/admin/ShopTools';
export const dynamic='force-dynamic';
export const metadata={title:'Coupons, shipping & inventory | Admin',robots:{index:false,follow:false}};
export default async function Page(){if(!hasAdminSession((await cookies()).get(ADMIN_COOKIE)?.value))redirect('/admin/login?next=/admin/shop-tools');return <ShopTools/>;}
