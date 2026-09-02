export const LEAD_SCHEMA_VERSION = 2;
export const LEAD_OWNERSHIP_MODEL = "creator_owner_v2";
export const LEAD_AGENT_LINK_MODE = "live_master_v2";

function firstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function getLeadTravelAgentId(lead = {}) {
  return firstValue(
    lead.travelAgentId,
    lead.agentId,
    lead.agencyId,
    lead.travelAgentRefId,
    lead.travelAgent?.id,
    lead.travelAgent?.agentId
  );
}

export function usesLiveTravelAgentMaster(lead = {}) {
  // Any lead that is linked to a Travel Agent master must resolve current
  // Travel Agent/SPOC details from that master. Older leads created before
  // live_master_v2 may not carry schemaVersion/agentLinkMode, but their
  // travelAgentId is still a valid relationship and must not freeze stale
  // email/mobile details forever.
  return Boolean(getLeadTravelAgentId(lead));
}

export function getTravelAgentPrimarySpoc(agent = {}) {
  const spocs = Array.isArray(agent?.spocs) ? agent.spocs.filter(Boolean) : [];

  return (
    spocs.find(item => item?.isPrimary) ||
    spocs.find(item => String(item?.status || '').trim().toLowerCase() === 'active') ||
    spocs[0] ||
    null
  );
}

export function getTravelAgentLiveSpoc(agent = {}, fallbackSpoc = {}) {
  const spocs = Array.isArray(agent?.spocs) ? agent.spocs.filter(Boolean) : [];
  const normalize = value => String(value || "").trim().toLowerCase();

  // Leads can be created against a non-primary SPOC. Preserve that
  // relationship when possible by matching the saved SPOC snapshot back to
  // the current Travel Agent master. Name is intentionally checked first so
  // correcting an email address does not break the match.
  const matchedSpoc =
    spocs.find(item =>
      fallbackSpoc?.name && normalize(item?.name) === normalize(fallbackSpoc.name)
    ) ||
    spocs.find(item =>
      fallbackSpoc?.mobile &&
      [item?.mobile, item?.phone, item?.whatsapp]
        .map(normalize)
        .includes(normalize(fallbackSpoc.mobile))
    ) ||
    spocs.find(item =>
      fallbackSpoc?.email && normalize(item?.email) === normalize(fallbackSpoc.email)
    ) ||
    null;

  const primarySpoc = getTravelAgentPrimarySpoc(agent);
  const activeSpoc = matchedSpoc || primarySpoc;

  return {
    name: firstValue(
      activeSpoc?.name,
      agent?.spocName,
      agent?.contactPersonName,
      agent?.primaryContactName,
      agent?.contactName,
      fallbackSpoc?.name
    ),
    designation: firstValue(
      activeSpoc?.designation,
      agent?.spocDesignation,
      agent?.contactDesignation,
      fallbackSpoc?.designation
    ),
    // A Lead's SPOC should follow the current SPOC record. Generic Contact is
    // a fallback only, not a replacement for a specifically selected SPOC.
    email: firstValue(
      activeSpoc?.email,
      agent?.genericContact?.email,
      agent?.spocEmail,
      agent?.contactEmail,
      agent?.primaryEmail,
      agent?.email,
      fallbackSpoc?.email
    ),
    mobile: firstValue(
      activeSpoc?.mobile,
      activeSpoc?.phone,
      activeSpoc?.whatsapp,
      agent?.genericContact?.phone,
      agent?.spocMobile,
      agent?.contactPhone,
      agent?.primaryPhone,
      agent?.phone,
      agent?.mobile,
      agent?.whatsappNumber,
      fallbackSpoc?.mobile,
      fallbackSpoc?.phone,
      fallbackSpoc?.whatsapp
    )
  };
}

export function buildLeadWithLiveTravelAgent(lead = {}, resolvedTravelAgent = {}) {
  if (!lead || typeof lead !== 'object') return lead;

  const liveSpoc = resolvedTravelAgent?.spoc || {};
  const hasLiveRelationship = Boolean(
    resolvedTravelAgent?.travelAgentId || getLeadTravelAgentId(lead)
  );

  if (!hasLiveRelationship) return lead;

  return {
    ...lead,
    travelAgentId: firstValue(
      resolvedTravelAgent?.travelAgentId,
      getLeadTravelAgentId(lead)
    ),
    travelAgentName: firstValue(
      resolvedTravelAgent?.agencyName,
      lead?.travelAgentName,
      lead?.agentName,
      lead?.agencyName
    ),
    spoc: {
      ...(lead?.spoc || {}),
      name: firstValue(liveSpoc?.name, lead?.spoc?.name),
      designation: firstValue(liveSpoc?.designation, lead?.spoc?.designation),
      email: firstValue(liveSpoc?.email, lead?.spoc?.email),
      mobile: firstValue(
        liveSpoc?.mobile,
        lead?.spoc?.mobile,
        lead?.spoc?.phone,
        lead?.spoc?.whatsapp
      )
    }
  };
}

export function buildLeadOwnerFields(user = {}) {
  const uid = firstValue(user.uid, user.id, user.userId);
  const email = firstValue(user.email, user.workEmail, user.officialEmail);
  const name = firstValue(
    user.name,
    user.fullName,
    user.displayName,
    email
  );
  const role = firstValue(user.role, user.designation, user.jobTitle);

  return {
    ownerUid: uid,
    ownerName: name,
    ownerEmail: email,
    ownerRole: role,
    ownershipModel: LEAD_OWNERSHIP_MODEL
  };
}

export function buildLeadAgentLinkFields(agent = {}) {
  const id = firstValue(agent.id, agent.travelAgentId, agent.agentId);
  const agencyName = firstValue(
    agent.agencyName,
    agent.agentName,
    agent.travelAgentName,
    agent.name
  );

  const primarySpoc = Array.isArray(agent.spocs)
    ? agent.spocs.find(item => item?.isPrimary) || agent.spocs[0] || null
    : null;

  return {
    travelAgentId: id,
    agentLinkMode: LEAD_AGENT_LINK_MODE,
    agentSnapshot: {
      agencyName,
      agentCode: firstValue(agent.agentCode),
      status: firstValue(agent.status),
      state: firstValue(agent.address?.state, agent.state),
      city: firstValue(agent.address?.city, agent.city),
      subArea: firstValue(agent.address?.subArea, agent.address?.area, agent.subArea, agent.area),
      pincode: firstValue(agent.address?.pincode, agent.pincode),
      primarySpoc: primarySpoc
        ? {
            name: firstValue(primarySpoc.name),
            email: firstValue(primarySpoc.email),
            mobile: firstValue(
              primarySpoc.mobile,
              primarySpoc.phone,
              primarySpoc.whatsapp
            )
          }
        : null
    }
  };
}

export function getLeadOwner(lead = {}) {
  const usesCreatorOwnerModel =
    lead.ownershipModel === LEAD_OWNERSHIP_MODEL ||
    Number(lead.schemaVersion || 0) >= LEAD_SCHEMA_VERSION;

  const uid = usesCreatorOwnerModel
    ? firstValue(
        lead.ownerUid,
        lead.createdByUid,
        lead.createdByUserId,
        lead.creatorUid
      )
    : firstValue(
        lead.createdByUid,
        lead.createdByUserId,
        lead.creatorUid
      );

  const email = usesCreatorOwnerModel
    ? firstValue(
        lead.ownerEmail,
        lead.createdByEmail,
        lead.createdBy,
        lead.creatorEmail
      )
    : firstValue(
        lead.createdByEmail,
        lead.createdBy,
        lead.creatorEmail
      );

  const name = usesCreatorOwnerModel
    ? firstValue(
        lead.ownerName,
        lead.createdByName,
        lead.creatorName,
        email
      )
    : firstValue(lead.createdByName, lead.creatorName, email);

  const role = usesCreatorOwnerModel
    ? firstValue(
        lead.ownerRole,
        lead.createdByRole,
        lead.creatorRole
      )
    : firstValue(lead.createdByRole, lead.creatorRole);

  return { uid, email, name, role };
}

export function getLeadAssignee(lead = {}) {
  const usesCreatorOwnerModel =
    lead.ownershipModel === LEAD_OWNERSHIP_MODEL ||
    Number(lead.schemaVersion || 0) >= LEAD_SCHEMA_VERSION;

  const uid = firstValue(
    lead.assignedToUid,
    lead.assignedUserUid,
    lead.assigneeUid,
    usesCreatorOwnerModel ? "" : lead.ownerUid
  );

  const email = firstValue(
    lead.assignedToEmail,
    lead.assignedUserEmail,
    lead.assigneeEmail,
    usesCreatorOwnerModel ? "" : lead.ownerEmail,
    typeof lead.assignedTo === "string" && lead.assignedTo.includes("@")
      ? lead.assignedTo
      : ""
  );

  const name = firstValue(
    lead.assignedToName,
    lead.assignedUserName,
    lead.assigneeName,
    usesCreatorOwnerModel ? "" : lead.ownerName,
    email,
    lead.assignedTo
  );

  const role = firstValue(
    lead.assignedToRole,
    lead.assignedUserRole,
    lead.assigneeRole,
    usesCreatorOwnerModel ? "" : lead.ownerRole
  );

  return { uid, email, name, role };
}

export function isLeadOwnedByUser(lead = {}, user = {}) {
  const owner = getLeadOwner(lead);
  const uid = firstValue(user.uid, user.id, user.userId);
  const email = normalizeEmail(
    firstValue(user.email, user.workEmail, user.officialEmail)
  );

  return Boolean(
    (uid && owner.uid === uid) ||
      (email && normalizeEmail(owner.email) === email)
  );
}

export function isLeadAssignedToUser(lead = {}, user = {}) {
  const assignee = getLeadAssignee(lead);
  const uid = firstValue(user.uid, user.id, user.userId);
  const email = normalizeEmail(
    firstValue(user.email, user.workEmail, user.officialEmail)
  );

  return Boolean(
    (uid && assignee.uid === uid) ||
      (email && normalizeEmail(assignee.email) === email)
  );
}

export function resolveLeadTravelAgent(lead = {}, agentMap) {
  const travelAgentId = getLeadTravelAgentId(lead);
  const liveAgent =
    usesLiveTravelAgentMaster(lead) && travelAgentId
      ? agentMap?.get?.(travelAgentId) || agentMap?.[travelAgentId]
      : null;

  if (!liveAgent) {
    const fallbackSpoc = {
      ...(lead?.agentSnapshot?.primarySpoc || {}),
      ...(lead?.spoc || {})
    };

    return {
      travelAgentId,
      agencyName: firstValue(
        lead.travelAgentName,
        lead.agentName,
        lead.agencyName,
        lead.agentSnapshot?.agencyName
      ),
      agentCode: firstValue(lead.agentCode, lead.agentSnapshot?.agentCode),
      status: firstValue(lead.agentSnapshot?.status),
      spoc: getTravelAgentLiveSpoc({}, fallbackSpoc),
      source: "lead_snapshot"
    };
  }

  return {
    travelAgentId,
    agencyName: firstValue(
      liveAgent.agencyName,
      liveAgent.name,
      lead.travelAgentName,
      lead.agentName
    ),
    agentCode: firstValue(liveAgent.agentCode, lead.agentCode),
    status: firstValue(liveAgent.status, lead.agentSnapshot?.status),
    city: firstValue(liveAgent.address?.city, liveAgent.city),
    spoc: getTravelAgentLiveSpoc(
      liveAgent,
      lead?.spoc || lead?.agentSnapshot?.primarySpoc || {}
    ),
    source: "travel_agent_master",
    agent: liveAgent
  };
}
