import { redirect } from "next/navigation";

// Fallback: beforeFiles rewrite in next.config.js handles / → /home.html.
// This page is only reached if the rewrite is bypassed.
export default function RootPage() {
  redirect("/home.html");
}
