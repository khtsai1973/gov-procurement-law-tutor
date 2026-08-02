import { ChatPanel } from "@/components/ChatPanel";

/** 首頁不在 server 讀 session，由 ChatPanel 客戶端判斷登入態，以降低 TTFB */
export default function Home() {
  return <ChatPanel />;
}
