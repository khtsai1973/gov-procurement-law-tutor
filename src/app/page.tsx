import { ChatPanel } from "@/components/ChatPanel";
import { getSession } from "@/lib/get-session";

export default async function Home() {
  const session = await getSession();
  return <ChatPanel signedIn={!!session?.user} />;
}
