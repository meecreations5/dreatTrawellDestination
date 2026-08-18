"use client";

import { useParams } from "next/navigation";
import TravelAgentForm from "../shared/TravelAgentForm";
import AdminGuard from "@/components/AdminGuard";

export default function EditTravelAgentPage() {
  const { agentId } = useParams();

  return (
    <AdminGuard>
      <TravelAgentForm mode="edit" agentId={agentId} />
    </AdminGuard>
  );
}
