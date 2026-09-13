import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";

export default async function HomePage() {
  const { user } = await getSessionProfile();
  if (!user) redirect("/login");
  redirect("/dashboard");
}
