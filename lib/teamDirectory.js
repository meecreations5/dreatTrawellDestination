const clean = value => String(value || "").trim();
const normalize = value => clean(value).toLowerCase();
const looksLikeEmail = value => clean(value).includes("@");
const USER_DOC_PREFIX = "userdoc:";

export const UNASSIGNED_TEAM_VALUE = "__unassigned_team__";
export const UNASSIGNED_TEAM_LABEL = "Unassigned Team";

export function getDirectoryUserEmail(user = {}) {
  // Some legacy Users rows accidentally stored the email in `name` or used an
  // email address as the Firestore document id. Treat those as aliases inside
  // the Users master so they merge with the proper user row instead of showing
  // up as a second staff option.
  const nameAsEmail = looksLikeEmail(user.name) ? user.name : "";
  const displayNameAsEmail = looksLikeEmail(user.displayName) ? user.displayName : "";

  return clean(
    user.email ||
      user.workEmail ||
      user.officialEmail ||
      nameAsEmail ||
      displayNameAsEmail ||
      (looksLikeEmail(user.id) ? user.id : "")
  ).toLowerCase();
}

/**
 * Return only a real Firebase/Auth UID. Firestore document ids are NOT treated
 * as Auth UIDs because this CRM historically created random user document ids.
 */
export function getDirectoryUserUid(user = {}) {
  return clean(user.uid || user.userUid || user.authUid || user.firebaseUid);
}

export function getDirectoryUserEmployeeId(user = {}) {
  return clean(user.employeeId || user.employeeCode || user.staffId || user.staffCode);
}

export function getDirectoryUserDocId(user = {}) {
  return clean(user.id || user.docId || user.userDocId);
}

export function getDirectoryUserName(user = {}) {
  const email = getDirectoryUserEmail(user);
  const candidates = [user.name, user.fullName, user.displayName, user.employeeName]
    .map(clean)
    .filter(value => value && !looksLikeEmail(value));

  return clean(candidates[0] || (email ? formatNameFromEmail(email) : ""));
}

export function getDirectoryUserMobile(user = {}) {
  return clean(
    user.mobile ||
      user.phone ||
      user.phoneNumber ||
      user.whatsapp ||
      user.whatsappNumber ||
      user.contactNumber ||
      user.officialMobile ||
      user.workMobile
  );
}

export function getDirectoryUserTeam(user = {}) {
  const team =
    user.teamName ||
    user.teamLabel ||
    (typeof user.team === "string" ? user.team : user.team?.name || user.team?.label) ||
    user.departmentName ||
    (typeof user.department === "string"
      ? user.department
      : user.department?.name || user.department?.label) ||
    "";

  return clean(team);
}

export function formatNameFromEmail(email = "") {
  const local = clean(email).split("@")[0] || "";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getRole(user = {}) {
  // Operation Executive is compatibility-stored as role=employee plus
  // accessRole=operation_executive in some user documents. Prefer the access
  // role so manager reporting and workstream attribution stay correct.
  return clean(user.accessRole || user.roleProfile || user.role || user.userRole || user.designation || user.type);
}

function getStatus(user = {}) {
  return clean(user.status || user.userStatus).toLowerCase();
}

function isDeletedUser(user = {}) {
  return Boolean(
    user.deleted === true ||
    user.isDeleted === true ||
    user.deletedAt ||
    getStatus(user) === "deleted"
  );
}

function isActiveUser(user = {}) {
  if (isDeletedUser(user) || user.active === false || user.disabled === true) {
    return false;
  }
  return !["inactive", "disabled", "blocked"].includes(getStatus(user));
}

function identityTokens(user = {}) {
  const uid = getDirectoryUserUid(user);
  const email = getDirectoryUserEmail(user);
  const employeeId = getDirectoryUserEmployeeId(user);
  const id = getDirectoryUserDocId(user);

  return [
    uid,
    email,
    employeeId ? `employee:${employeeId}` : "",
    id ? `doc:${id}` : "",
    id
  ]
    .filter(Boolean)
    .map(normalize);
}

function createBucket() {
  return {
    uid: "",
    docId: "",
    email: "",
    name: "",
    team: "",
    role: "",
    mobile: "",
    active: false,
    aliases: new Set(),
    nameAliases: new Set(),
    docIds: new Set()
  };
}

function mergeMember(target, user) {
  const uid = getDirectoryUserUid(user);
  const docId = getDirectoryUserDocId(user);
  const email = getDirectoryUserEmail(user);
  const employeeId = getDirectoryUserEmployeeId(user);
  const name = getDirectoryUserName(user);
  const team = getDirectoryUserTeam(user);
  const role = getRole(user);
  const mobile = getDirectoryUserMobile(user);

  const promotesCanonicalRow = Boolean(uid) && !target.uid;

  if (!target.uid && uid) target.uid = uid;
  if ((!target.docId || promotesCanonicalRow) && docId) target.docId = docId;
  if ((!target.email || promotesCanonicalRow) && email) target.email = email;
  if ((!target.name || looksLikeEmail(target.name) || promotesCanonicalRow) && name) target.name = name;
  if ((!target.team || promotesCanonicalRow) && team) target.team = team;
  if ((!target.role || promotesCanonicalRow) && role) target.role = role;
  if ((!target.mobile || promotesCanonicalRow) && mobile) target.mobile = mobile;
  target.active = target.active || isActiveUser(user);

  identityTokens(user).forEach(token => target.aliases.add(token));
  if (name) target.nameAliases.add(normalize(name));
  if (email) target.aliases.add(normalize(email));
  if (employeeId) target.aliases.add(normalize(`employee:${employeeId}`));
  if (uid) target.aliases.add(normalize(uid));
  if (docId) {
    target.aliases.add(normalize(docId));
    target.docIds.add(docId);
  }
}

function mergeBuckets(target, source) {
  if (!target.uid && source.uid) target.uid = source.uid;
  if (!target.docId && source.docId) target.docId = source.docId;
  if (!target.email && source.email) target.email = source.email;
  if (!target.name && source.name) target.name = source.name;
  if (!target.team && source.team) target.team = source.team;
  if (!target.role && source.role) target.role = source.role;
  if (!target.mobile && source.mobile) target.mobile = source.mobile;
  target.active = target.active || source.active;
  source.aliases.forEach(alias => target.aliases.add(alias));
  source.nameAliases.forEach(alias => target.nameAliases.add(alias));
  source.docIds.forEach(id => target.docIds.add(id));
}

/**
 * Canonical staff directory sourced ONLY from Firestore `users` documents.
 *
 * - Duplicate user documents are merged by UID/email/document id aliases.
 * - A dropdown value is never a name or email. It is Auth UID when known,
 *   otherwise a namespaced Users document id (`userdoc:<id>`).
 * - Email/name remain aliases only for resolving legacy CRM records.
 * - Active users remain available even when they have zero CRM activity.
 */
export function buildTeamDirectory(users = [], { includeInactive = false } = {}) {
  const buckets = [];

  users.forEach(user => {
    // Deleted Users rows must never become operational filter options. Inactive
    // users can still be included for historical reporting when requested.
    if (isDeletedUser(user)) return;

    const tokens = new Set(identityTokens(user));
    const name = getDirectoryUserName(user);
    if (!tokens.size && !name) return;

    let bucket = buckets.find(item =>
      Array.from(tokens).some(token => item.aliases.has(token))
    );

    if (!bucket) {
      bucket = createBucket();
      buckets.push(bucket);
    }

    mergeMember(bucket, user);

    // A later Users document can connect two buckets (for example a UID row
    // and an older email-keyed row). Merge all connected buckets now.
    for (let index = buckets.length - 1; index >= 0; index -= 1) {
      const other = buckets[index];
      if (other === bucket) continue;

      const overlaps = Array.from(other.aliases).some(alias => bucket.aliases.has(alias));
      if (!overlaps) continue;

      mergeBuckets(bucket, other);
      buckets.splice(index, 1);
    }
  });

  // Legacy Users data sometimes contains one name-only row plus one normal row.
  // Merge by normalized name only when emails do not conflict. This never pulls
  // identities from Leads/Engagements/Travel Agents; both rows are Users rows.
  for (let i = buckets.length - 1; i >= 0; i -= 1) {
    const current = buckets[i];
    const currentName = normalize(current.name);
    if (!currentName) continue;

    for (let j = i - 1; j >= 0; j -= 1) {
      const candidate = buckets[j];
      if (normalize(candidate.name) !== currentName) continue;

      const currentEmail = normalize(current.email);
      const candidateEmail = normalize(candidate.email);
      const conflictingEmails = currentEmail && candidateEmail && currentEmail !== candidateEmail;
      if (conflictingEmails) continue;

      mergeBuckets(candidate, current);
      buckets.splice(i, 1);
      break;
    }
  }

  const directory = buckets
    .filter(member => includeInactive || member.active)
    .map(member => {
      const uid = clean(member.uid);
      const docId = clean(member.docId) || Array.from(member.docIds)[0] || "";
      const key = uid || (docId ? `${USER_DOC_PREFIX}${docId}` : "");
      const name = clean(member.name) || formatNameFromEmail(member.email) || "Unnamed Team Member";

      return {
        key,
        value: key,
        uid,
        docId,
        email: clean(member.email),
        name,
        label: name,
        team: clean(member.team),
        role: clean(member.role),
        mobile: clean(member.mobile),
        active: member.active,
        aliases: Array.from(member.aliases),
        nameAliases: Array.from(member.nameAliases),
        docIds: Array.from(member.docIds)
      };
    })
    .filter(member => member.key);

  const nameCounts = new Map();
  directory.forEach(member => {
    const key = normalize(member.name);
    if (key) nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  });

  return directory
    .map(member => {
      const duplicateName = (nameCounts.get(normalize(member.name)) || 0) > 1;
      const disambiguated = duplicateName && member.email
        ? `${member.name} — ${member.email}`
        : member.name;
      return {
        ...member,
        label: member.active ? disambiguated : `${disambiguated} (Inactive)`
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildTeamDirectoryLookup(directory = []) {
  const lookup = new Map();
  const nameOwners = new Map();

  directory.forEach(member => {
    [member.key, member.uid, member.docId, member.email, ...(member.docIds || []), ...(member.aliases || [])]
      .filter(Boolean)
      .forEach(value => lookup.set(normalize(value), member));

    const names = new Set(
      [member.name, ...(member.nameAliases || [])]
        .filter(Boolean)
        .map(normalize)
    );

    names.forEach(name => {
      if (!nameOwners.has(name)) nameOwners.set(name, []);
      nameOwners.get(name).push(member);
    });
  });

  // Name-only legacy CRM records are mapped only when one canonical Users row
  // owns the name. Ambiguous same-name people intentionally remain unmapped.
  nameOwners.forEach((members, name) => {
    const unique = Array.from(new Set(members.map(member => member.key)))
      .map(key => members.find(member => member.key === key))
      .filter(Boolean);

    if (unique.length === 1 && !lookup.has(name)) lookup.set(name, unique[0]);
  });

  return lookup;
}

export function getTeamOptions(directory = []) {
  const teams = Array.from(
    new Set(directory.map(member => clean(member.team)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  if (directory.some(member => !clean(member.team))) {
    teams.push(UNASSIGNED_TEAM_VALUE);
  }

  return teams;
}

export function getTeamOptionLabel(value = "") {
  return value === UNASSIGNED_TEAM_VALUE ? UNASSIGNED_TEAM_LABEL : clean(value);
}

export function teamMatchesScope(memberTeam = "", scopeTeam = "all") {
  if (!scopeTeam || scopeTeam === "all") return true;
  if (scopeTeam === UNASSIGNED_TEAM_VALUE) return !clean(memberTeam);
  return normalize(memberTeam) === normalize(scopeTeam);
}

export function getMembersForTeam(directory = [], team = "all") {
  if (!team || team === "all") return directory;
  if (team === UNASSIGNED_TEAM_VALUE) return directory.filter(member => !clean(member.team));
  const target = normalize(team);
  return directory.filter(member => normalize(member.team) === target);
}

export function findDirectoryMember(directory = [], value = "") {
  const needle = normalize(value);
  if (!needle) return null;

  const direct = directory.find(member =>
    [
      member.key,
      member.uid,
      member.docId,
      member.email,
      ...(member.docIds || []),
      ...(member.aliases || [])
    ]
      .filter(Boolean)
      .some(alias => normalize(alias) === needle)
  );
  if (direct) return direct;

  const nameMatches = directory.filter(member =>
    [member.name, ...(member.nameAliases || [])]
      .filter(Boolean)
      .some(alias => normalize(alias) === needle)
  );

  return nameMatches.length === 1 ? nameMatches[0] : null;
}

export function memberMatchesValues(member, values = []) {
  if (!member) return false;

  const aliases = new Set(
    [
      member.key,
      member.uid,
      member.docId,
      member.email,
      member.name,
      ...(member.docIds || []),
      ...(member.aliases || []),
      ...(member.nameAliases || [])
    ]
      .filter(Boolean)
      .map(normalize)
  );

  return values
    .filter(Boolean)
    .map(normalize)
    .some(value => aliases.has(value));
}

export function resolveDirectoryIdentity(
  { uid = "", email = "", name = "", userId = "" } = {},
  lookup
) {
  const user =
    (uid && lookup?.get?.(normalize(uid))) ||
    (userId && lookup?.get?.(normalize(userId))) ||
    (email && lookup?.get?.(normalize(email))) ||
    (name && lookup?.get?.(normalize(name))) ||
    null;

  if (user) {
    return {
      key: user.key,
      uid: user.uid,
      docId: user.docId,
      email: user.email,
      name: user.name,
      team: user.team,
      role: user.role,
      mobile: user.mobile || "",
      isUnmapped: false
    };
  }

  const cleanEmail = clean(email);
  const cleanName = clean(name);

  if (cleanEmail) {
    const legacyName = cleanName || formatNameFromEmail(cleanEmail) || cleanEmail;
    return {
      key: `legacy:${normalize(cleanEmail)}`,
      uid: "",
      docId: "",
      email: cleanEmail,
      name: `Legacy / Unmapped — ${legacyName}`,
      team: "",
      role: "",
      mobile: "",
      isUnmapped: true
    };
  }

  if (cleanName && !/^[a-z0-9_-]{20,}$/i.test(cleanName)) {
    return {
      key: `legacy-name:${normalize(cleanName)}`,
      uid: "",
      docId: "",
      email: "",
      name: `Legacy / Unmapped — ${cleanName}`,
      team: "",
      role: "",
      mobile: "",
      isUnmapped: true
    };
  }

  return {
    key: "legacy-unmapped",
    uid: "",
    docId: "",
    email: "",
    name: "Legacy / Unmapped",
    team: "",
    role: "",
    isUnmapped: true
  };
}
