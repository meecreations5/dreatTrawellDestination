// lib/addFollowUp.js

import { logLeadAction, LEAD_TIMELINE_TYPES } from "./logLeadAction";
import { logFollowUp } from "@/lib/logFollowUp";
export async function addLeadFollowUp({
  leadId,
  channel,
  note,
  nextFollowUpAt,
  user
}) {
  await logLeadAction({
    leadId,
    type: LEAD_TIMELINE_TYPES.FOLLOW_UP,
    title: "Follow-up Logged",
    description: note,
    metadata: {
      channel,
      nextFollowUpAt
    },
    user
  });
}
