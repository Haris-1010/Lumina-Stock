import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SocialAccountsClient } from "./_client";

export default async function SocialAccountsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  return <SocialAccountsClient userId={session.userId} />;
}
