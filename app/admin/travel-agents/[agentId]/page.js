// admin/travel-agents/[agentId]/TravelAgentForm.js
"use client";

import { useParams } from "next/navigation";
import TravelAgentForm from "../shared/TravelAgentForm";

export default function EditTravelAgentPage() {
  const { agentId } = useParams();
  return <TravelAgentForm mode="edit" agentId={agentId} />;
}
