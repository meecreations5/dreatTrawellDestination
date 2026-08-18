"use client";

import MeetingsWorkspace from "@/components/meetings/MeetingsWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useUserDirectory } from "@/hooks/useUserDirectory";

export default function MyMeetingsPage() {
  const { user } = useAuth();
  const { directory } = useUserDirectory();
  const currentMember = directory.find(member => member.uid === user?.uid || member.email === String(user?.email || "").toLowerCase());
  const key = currentMember?.key || user?.uid || "";
  return <MeetingsWorkspace user={user} teamDirectory={directory} defaultAssigneeKey={key} />;
}
