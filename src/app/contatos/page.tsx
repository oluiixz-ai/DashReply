import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DashboardClient from "../dashboard-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await getSession())) redirect("/login");
  return <DashboardClient initialSection="Contatos" />;
}
