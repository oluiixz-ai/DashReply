import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DashboardClient from "../dashboard-client";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <DashboardClient initialSection="Estúdio de conteúdo" />;
}
