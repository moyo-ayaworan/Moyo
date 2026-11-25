import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Review email preferences | Stillbounds",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function ReviewEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
