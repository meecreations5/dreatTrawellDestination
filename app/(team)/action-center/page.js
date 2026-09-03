"use client";

import ActionCenterWorkspace from "@/components/action-center/ActionCenterWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useUserDirectory } from "@/hooks/useUserDirectory";

export default function MyActionCenterPage() {
  const { user } = useAuth();
  const { lookup, directory } = useUserDirectory({ includeInactive: true });
  return <ActionCenterWorkspace user={user} userLookup={lookup} directory={directory} />;
}
