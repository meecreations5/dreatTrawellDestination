"use client";

import AdminGuard from "@/components/AdminGuard";
import ActionCenterWorkspace from "@/components/action-center/ActionCenterWorkspace";
import { useAdminScope } from "@/components/admin/AdminScopeProvider";
import { useAuth } from "@/hooks/useAuth";

export default function AdminActionCenterPage() {
  const { user } = useAuth();
  const { scope, userLookup } = useAdminScope();
  return (
    <AdminGuard>
      <ActionCenterWorkspace adminMode user={user} scopeTeam={scope.team} userLookup={userLookup} />
    </AdminGuard>
  );
}
