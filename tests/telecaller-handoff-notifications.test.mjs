import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_HANDOFF_SETTINGS, FIRST_CONTACT_OUTCOMES, asMillis, handoffDeadline,
  handoffStatus, isHandoffOverdue, isHandoffUnread, isTelecallingHandoff,
  normalizeHandoffSettings, validateFirstContact
} from "../lib/handoffCore.mjs";
import { canAccess, getRequiredPermissionForPath } from "../lib/rolePermissions.js";
const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
const one = { source:"telecalling", handoffType:"telecalling_handoff", agentId:"agent-1", assignedToUid:"auth-uid", firstContactDueAt: new Date("2026-11-23T06:00:00.000Z"), handoffStatus:"assigned" };

test("New travel agent assignment is notified only once as a handover, not a second booking", () => {
  assert.ok(isTelecallingHandoff(one));
  assert.equal(isTelecallingHandoff({ ...one, handoffType:undefined }), false);
  assert.equal(isTelecallingHandoff({ ...one, source:"lead_assignment" }), false);
  assert.equal(isHandoffUnread(one), true);
  assert.equal(isHandoffUnread({ ...one, handoffStatus:"accepted" }), false);
});
test("New, Accepted, and Contacted are distinct; missed calls do not clear overdue handover", () => {
  assert.equal(handoffStatus(one), "assigned");
  assert.equal(handoffStatus({ ...one, handoffStatus:"accepted" }), "accepted");
  assert.equal(handoffStatus({ ...one, handoffStatus:"contacted" }), "contacted");
  assert.equal(isHandoffOverdue(one, new Date("2026-11-23T06:01:00.000Z")), true);
  assert.equal(isHandoffOverdue({ ...one, handoffStatus:"accepted" }, new Date("2026-11-23T06:01:00.000Z")), true);
  assert.equal(isHandoffOverdue({ ...one, handoffStatus:"contacted" }, new Date("2026-11-23T06:01:00.000Z")), false);
});
test("SLA is configurable with a safe 4-hour default and bounded input", () => {
  assert.equal(DEFAULT_HANDOFF_SETTINGS.firstContactHours, 4);
  assert.equal(normalizeHandoffSettings({ firstContactHours:0 }).firstContactHours, 1);
  assert.equal(normalizeHandoffSettings({ firstContactHours:70 }).firstContactHours, 48);
  assert.equal(normalizeHandoffSettings({ firstContactHours:"abc" }).firstContactHours, 4);
  assert.equal(handoffDeadline("2026-11-23T06:00:00.000Z", {firstContactHours:3}).toISOString(), "2026-11-23T09:00:00.000Z");
  assert.equal(asMillis(one.firstContactDueAt), Date.parse("2026-11-23T06:00:00.000Z"));
});
test("Only genuine connected calls complete first contact", () => {
  assert.equal(FIRST_CONTACT_OUTCOMES.find(r=>r.value === "connected").connected, true);
  assert.equal(FIRST_CONTACT_OUTCOMES.find(r=>r.value === "follow_up").connected, true);
  assert.equal(FIRST_CONTACT_OUTCOMES.find(r=>r.value === "no_answer").connected, false);
  assert.equal(FIRST_CONTACT_OUTCOMES.find(r=>r.value === "busy").connected, false);
  assert.equal(validateFirstContact({outcome:"no_answer",summary:"Called, nobody answered"}).connected, false);
  assert.throws(()=>validateFirstContact({outcome:"connected",summary:"no"}), /five characters/);
  assert.throws(()=>validateFirstContact({outcome:"something",summary:"Connected with agent"}), /valid first-contact outcome/);
});
test("User handover page is a scoped team view; Telecaller stays restricted", () => {
  assert.equal(getRequiredPermissionForPath("/my-handoffs"), "travel_agents.view");
  assert.equal(canAccess({uid:"caller",role:"telecaller",active:true},"leads.view"), false);
  assert.match(source("../components/layout/AppLayout.js"), /HandoffBell user=\{user\}/);
  assert.match(source("../components/layout/AppLayout.js"), /module.id !== "my-handoffs"/);
  assert.match(source("../app/(team)/my-handoffs/page.js"), /MyHandoffsWorkspace/);
});
test("Notification is committed in same Firestore transaction as agent ownership", () => {
  const service = source("../lib/telecallingService.js");
  assert.match(service, /trx\.update\(agentRef/);
  assert.match(service, /trx\.set\(assignmentRef/);
  assert.match(service, /handoffType: "telecalling_handoff", handoffStatus: "assigned"/);
  assert.match(service, /assignedToUid: targetAuthUid/);
  assert.match(service, /assignedToUserDocId: userSnap\.id/);
  assert.match(source("../components/telecalling/TelecallingWorkspace.js"), /value=\{u.id\}/);
});
test("First contact is an Engagement transaction, not a UI-only status change", () => {
  const service = source("../lib/handoffService.js");
  assert.match(service, /trx\.set\(engagementRef/);
  assert.match(service, /trx\.update\(assignmentRef/);
  assert.match(service, /firstContactEngagementId: engagementRef.id/);
  assert.match(service, /handoffStatus: "contacted"/);
  assert.match(service, /clean\(agentSnap\.data\(\)\.assignedToUid/);
  assert.match(service, /where\("assignedToUid", "==", clean\(user.uid\)\)/);
});
test("Management overdue queue and Admin SLA settings remain role controlled", () => {
  const panel = source("../components/handoffs/HandoffMonitoring.js");
  assert.match(panel, /"admin", "super_admin", "manager"/);
  assert.match(panel, /"admin", "super_admin"/);
  assert.match(panel, /isHandoffOverdue/);
  assert.match(source("../components/action-center/ActionCenterWorkspace.js"), /HandoffActionAlert/);
});
