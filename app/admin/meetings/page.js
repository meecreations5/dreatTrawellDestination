"use client";

import AdminGuard from "@/components/AdminGuard";
import MeetingsWorkspace from "@/components/meetings/MeetingsWorkspace";
import { useAdminScope } from "@/components/admin/AdminScopeProvider";
import { useAuth } from "@/hooks/useAuth";

export default function AdminMeetingsPage() {
  const { user } = useAuth();
  const { scope, teamDirectory } = useAdminScope();
  return <AdminGuard permission="meetings.view"><MeetingsWorkspace adminMode user={user} scope={scope} teamDirectory={teamDirectory} /></AdminGuard>;
}
