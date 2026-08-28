import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { homeForRole } from "@/lib/types";

export default async function HomePage() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login");
  redirect(homeForRole(profile?.role));
}
