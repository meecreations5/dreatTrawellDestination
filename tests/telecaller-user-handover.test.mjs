import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getRequiredPermissionForPath, canAccess } from "../lib/rolePermissions.js";
import {
  buildTelecallerHandoverMessage,
  buildTelecallerHandoverWhatsAppUrl,
  canPrepareHandoverWhatsApp,
  normalizeHandoverPhone
} from "../lib/telecallingWhatsApp.mjs";

const caller = { uid: "caller-1", role: "telecaller", active: true };
const assigned = { assignedToName: "Pallavi", telecallerHandoffAt: new Date(), telecallerHandoffByUid: "caller-1", preferredCommunication: { whatsapp: true } };

test("User Telecalling is permission-protected, while lead/finance access remains denied", () => {
  assert.equal(getRequiredPermissionForPath("/telecalling"), "telecalling.view");
  assert.equal(getRequiredPermissionForPath("/telecalling/"), "telecalling.view");
  assert.equal(canAccess(caller, "telecalling.view"), true);
  for (const key of ["leads.view", "payments.create", "invoices.vendor.view", "users.manage_role"]) assert.equal(canAccess(caller, key), false);
  assert.match(readFileSync(new URL("../config/appNavigation.js", import.meta.url), "utf8"), /base: "\/telecalling"/);
  assert.match(readFileSync(new URL("../app/(team)/telecalling/page.js", import.meta.url), "utf8"), /TelecallingWorkspace/);
  const login = readFileSync(new URL("../app/login/page.js", import.meta.url), "utf8");
  assert.match(login, /telecaller" \? "\/telecalling"/);
  const layout = readFileSync(new URL("../components/layout/AppLayout.js", import.meta.url), "utf8");
  assert.match(layout, /telecallerTeamPathAllowed/);
  assert.match(layout, /resolveUserRole\(user\) !== "telecaller" && <ProductivityPulse/);
});

test("WhatsApp handover message includes the selected manager and greeting", () => {
  const text = buildTelecallerHandoverMessage({ contactName: "Ms. Neha", managerName: "Pallavi" });
  assert.match(text, /Hi Ms. Neha,/);
  assert.match(text, /Relationship Manager, Pallavi,/);
  assert.match(text, /will get in touch with you shortly/);
  assert.match(text, /DreamTrawell Destination DMC/);
  assert.doesNotMatch(text, /XXXX|undefined|\[Relationship Manager/);
  assert.throws(() => buildTelecallerHandoverMessage({ contactName: "Neha", managerName: "" }), /name is required/);
});

test("WhatsApp links use the actual contact phone and URL encode the message", () => {
  assert.equal(normalizeHandoverPhone("98765 43210"), "919876543210");
  assert.equal(normalizeHandoverPhone("+971 50 123 4567"), "971501234567");
  assert.equal(normalizeHandoverPhone("123"), "");
  assert.equal(buildTelecallerHandoverWhatsAppUrl({ mobile: "123", message: "Hello" }), "");
  const url = buildTelecallerHandoverWhatsAppUrl({ mobile: "9876543210", message: "Hello Pallavi!" });
  assert.equal(url, "https://wa.me/919876543210?text=Hello%20Pallavi!");
});

test("Do not prepare WhatsApp before handover or after opt-out", () => {
  assert.equal(canPrepareHandoverWhatsApp({}), false);
  assert.equal(canPrepareHandoverWhatsApp(assigned), true);
  assert.equal(canPrepareHandoverWhatsApp({ ...assigned, preferredCommunication: { whatsapp: false } }), false);
  assert.equal(canPrepareHandoverWhatsApp({ ...assigned, status: "do not contact" }), false);
  assert.equal(canPrepareHandoverWhatsApp({ ...assigned, assignedToName: "person@example.com" }), false);
});
