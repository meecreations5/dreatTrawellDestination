// app/(team)/layout.js
export const dynamic = "force-dynamic";
import AppLayout from "@/components/layout/AppLayout";

export default function TeamLayout({ children }) {
  return <AppLayout>{children}</AppLayout>;
}
  