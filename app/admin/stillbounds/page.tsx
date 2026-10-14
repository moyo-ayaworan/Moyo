import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, hasAdminSession } from "@/lib/auth";
import MoyoStudio from "@/components/studio/MoyoStudio";
export const metadata = {
  title: "Moyo Studio | Stillbounds",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!hasAdminSession((await cookies()).get(ADMIN_COOKIE)?.value))
    redirect("/admin/login?next=/admin/stillbounds");
  return <MoyoStudio />;
}
