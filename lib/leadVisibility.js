export function isDeletedLead(lead) {
  return lead?.isDeleted === true || lead?.deleted === true;
}

export function getActiveLeads(leads = []) {
  if (!Array.isArray(leads)) return [];
  return leads.filter(lead => !isDeletedLead(lead));
}