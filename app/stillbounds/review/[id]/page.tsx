import { notFound } from "next/navigation";
import ClientReview from "@/components/studio/ClientReview";
import { uuid } from "@/lib/studio/protocol";
export const metadata = {
  title: "Private book review | Moyo",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  return <ClientReview id={id} />;
}
