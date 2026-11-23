import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getTelecallingContacts, getPreferredTelecallingContact,
  getTelecallingContactSearchText, telephoneHref, emailHref
} from "../lib/telecallingContacts.mjs";
import { canAccess } from "../lib/rolePermissions.js";

const caller = { uid: "caller-1", role: "telecaller", active: true };
const source = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Displays primary SPOC and call link in Telecalling list", () => {
  const agent = { agencyName: "ABC Travels", address: { city: "Mumbai" }, spocs:[
    { name:"Rahul", mobile:"+91 98765 43210", email:"rahul@example.com", isPrimary:true },
    { name:"Neha", mobile:"9876543211", isPrimary:false }
  ] };
  assert.equal(getPreferredTelecallingContact(agent).name, "Rahul");
  assert.equal(getPreferredTelecallingContact(agent).phone, "+91 98765 43210");
  assert.equal(telephoneHref(getPreferredTelecallingContact(agent).phone), "tel:+919876543210");
  assert.equal(emailHref(getPreferredTelecallingContact(agent).email), "mailto:rahul%40example.com");
  assert.equal(getTelecallingContacts(agent).length, 2);
  assert.match(getTelecallingContactSearchText(agent), /neha/);
  assert.match(getTelecallingContactSearchText(agent), /mumbai/);
  assert.match(getTelecallingContactSearchText(agent), /9876543211/);
});

test("Uses general agency phone for imports without SPOCs", () => {
  const agent = { agencyName:"Bulk Uploaded Travel", genericContact: { phone:"022-4567 8901", email:"info@example.com" } };
  const contact = getPreferredTelecallingContact(agent);
  assert.equal(contact.kind, "agency");
  assert.equal(contact.name, "Agency / office");
  assert.equal(contact.phone, "022-4567 8901");
  assert.equal(contact.email, "info@example.com");
  assert.equal(telephoneHref(contact.phone), "tel:02245678901");
});

test("A secondary SPOC number does not appear under the primary SPOC's name", () => {
  const agent = { spocs:[
    { name:"Primary SPOC", isPrimary:true },
    { name:"Alternate Contact", mobile:"9876543210" }
  ] };
  const preferred = getPreferredTelecallingContact(agent);
  assert.equal(preferred.name, "Alternate Contact");
  assert.equal(preferred.index, 1);
  assert.equal(preferred.phone, "9876543210");
});

test("Keeps named primary contact and a different agency office number separate", () => {
  const contacts = getTelecallingContacts({
    spocs:[{name:"Sana", mobile:"9876500011", isPrimary:true}],
    genericContact: { phone: "022-1122 3344" }
  });
  assert.deepEqual(contacts.map(x=>x.kind), ["person", "agency"]);
  assert.equal(contacts[0].name, "Sana");
  assert.equal(contacts[1].phone, "022-1122 3344");
});

test("Legacy contact fields, absent contacts, and invalid URLs are handled", () => {
  assert.equal(getPreferredTelecallingContact({ contactPerson:"Meera", contactNumber:"9876543210" }).name, "Meera");
  assert.equal(getPreferredTelecallingContact({ phoneNumber:"9876543210" }).phone, "9876543210");
  assert.deepEqual(getTelecallingContacts({}), []);
  assert.equal(getPreferredTelecallingContact({}).phone, "");
  assert.equal(telephoneHref("javascript:alert(1)"), "");
  assert.equal(telephoneHref("123"), "");
  assert.equal(emailHref("not-an-email"), "");
});

test("Contact details remain available only inside the role-controlled workspaces", () => {
  assert.equal(canAccess(caller,"telecalling.view"), true);
  assert.equal(canAccess({uid:"visitor",role:"telecaller",active:false}, "telecalling.view"), false);
  assert.equal(canAccess(caller,"payments.create"), false);
  const telecalling = source("../components/telecalling/TelecallingWorkspace.js");
  const handoff = source("../components/handoffs/MyHandoffsWorkspace.js");
  const service = source("../lib/telecallingService.js");
  assert.match(telecalling, /if \(!mayView\) return/);
  assert.match(telecalling, /getPreferredTelecallingContact\(item\)/);
  assert.match(telecalling, /getTelecallingContacts\(agent\)/);
  assert.match(telecalling, /getTelecallingContactSearchText/);
  assert.match(telecalling, /Call \{contact.phone\}/);
  assert.match(handoff, /Phone: \{row.contactPhone \|\| "Not recorded"\}/);
  assert.match(service, /const contact = getPreferredTelecallingContact\(agent\)/);
});
