import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getPreferredTelecallingContact,
  getTelecallingContacts,
  getTelecallingContactSearchText,
  hasTelecallingPhone,
  telephoneHref
} from "../lib/telecallingContacts.mjs";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("With phone accepts a valid number in any SPOC, not only primary SPOC", () => {
  const agent = { agencyName: "Ace Travels", spocs: [
    { name: "First", isPrimary: true, phone: "Not available" },
    { name: "Second", mobile: "+91 98765 43210" }
  ] };
  assert.equal(hasTelecallingPhone(agent), true);
  assert.equal(getPreferredTelecallingContact(agent).name, "Second");
  assert.equal(getPreferredTelecallingContact(agent).phone, "+91 98765 43210");
});

test("With phone recognises general contact and legacy top-level phone fields", () => {
  for (const sourceField of ["phone", "mobile", "contactNumber", "spocMobile", "contactPhone", "primaryPhone", "officePhone", "whatsappNumber", "phoneNo", "mobileNo", "landline"]) {
    const agent = { agencyName: "Sample Tours", [sourceField]: "9876543210" };
    assert.equal(hasTelecallingPhone(agent), true, `expected ${sourceField}`);
    assert.equal(getPreferredTelecallingContact(agent).phone, "9876543210", sourceField);
  }
  assert.equal(hasTelecallingPhone({ genericContact: { phone: "022 4567 8901" } }), true);
  assert.equal(getPreferredTelecallingContact({ genericContact: { phone: "Not recorded" }, primaryPhone: "9876543210" }).phone, "9876543210");
});

test("With phone checks alternate contact objects and arrays", () => {
  const agent = { agencyName: "Old Import", contacts: [{ name: "Abhay", telephone: "9123456780" }] };
  assert.equal(hasTelecallingPhone(agent), true);
  assert.equal(getPreferredTelecallingContact(agent).name, "Abhay");
  assert.match(getTelecallingContactSearchText(agent), /9123456780/);
  assert.equal(hasTelecallingPhone({ contactDetails: { contactNo: "9876543210" } }), true);
  assert.equal(hasTelecallingPhone({ additionalContacts: [{ phone: "9988776655" }] }), true);
  assert.equal(hasTelecallingPhone({ spocs: { mobile: "9876543210" } }), true);
  assert.equal(hasTelecallingPhone({ genericContact: { phoneNumbers: ["", "9123456780"] } }), true);
});

test("With phone handles multiple numbers in one field and displays all", () => {
  const agent = { genericContact: { phone: "9876543210 / 9123456780" } };
  const contact = getPreferredTelecallingContact(agent);
  assert.deepEqual(contact.phones, ["9876543210", "9123456780"]);
  assert.equal(contact.phone, "9876543210");
  assert.match(getTelecallingContactSearchText(agent), /9123456780/);
});

test("Missing phone excludes empty, placeholder, short or unrelated numeric fields", () => {
  for (const agent of [
    {},
    { genericContact: { phone: "" }, spocs: [{ name: "Sana" }] },
    { phone: "Not recorded" },
    { phone: "123" },
    { phone: "0000000000" },
    { bankDetails: { accountNumber: "123456789012" }, address: { pincode: "400001" }, gstNumber: "123456789012345" }
  ]) {
    assert.equal(hasTelecallingPhone(agent), false, JSON.stringify(agent));
  }
  assert.equal(telephoneHref("0000000000"), "");
});

test("Phone-filter UI offers all, with phone, and missing phone with callable default", () => {
  const ui = source("../components/telecalling/TelecallingWorkspace.js");
  assert.match(ui, /setPhoneFilter\] = useState\("with_phone"\)/);
  assert.match(ui, /<option value="with_phone">With phone number/);
  assert.match(ui, /<option value="all">All agents/);
  assert.match(ui, /<option value="missing_phone">Missing phone number/);
  assert.match(ui, /const hasPhone = hasTelecallingPhone\(a\)/);
  assert.match(ui, /contact\.phones\?\.length/);
  assert.match(ui, /getTelecallingContactSearchText\(a\)/);
});
