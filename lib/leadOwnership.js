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
  return (
    Number(lead.schemaVersion || 0) >= LEAD_SCHEMA_VERSION &&
    lead.agentLinkMode === LEAD_AGENT_LINK_MODE &&
    Boolean(getLeadTravelAgentId(lead))
  );
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
    source: "travel_agent_master",
    agent: liveAgent
  };
}
