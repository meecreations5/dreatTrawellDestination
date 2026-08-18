const clean = value => String(value || "").trim();
const normalize = value => clean(value).toLowerCase();

export function getTravelAgentLocationParts(agent = {}) {
  const address = agent.address || agent.officeAddress || agent.billingAddress || {};
  const nestedLocation = agent.location && typeof agent.location === "object" ? agent.location : {};

  return {
    state: clean(address.state || nestedLocation.state || agent.state),
    city: clean(address.city || nestedLocation.city || agent.city || agent.officeCity),
    subArea: clean(
      address.subArea ||
      address.subarea ||
      address.area ||
      address.locality ||
      nestedLocation.subArea ||
      nestedLocation.area ||
      agent.subArea ||
      agent.area ||
      agent.locality
    ),
    pincode: clean(address.pincode || address.pinCode || nestedLocation.pincode || agent.pincode),
    line1: clean(address.line1 || address.addressLine1 || nestedLocation.line1),
    line2: clean(address.line2 || address.addressLine2 || nestedLocation.line2),
    country: clean(address.country || nestedLocation.country || agent.country || "India")
  };
}

export function getLeadAgentLocationParts(lead = {}, travelAgent = null) {
  if (travelAgent) return getTravelAgentLocationParts(travelAgent);

  const snapshot = lead.agentLocation || lead.travelAgentLocation || lead.agentAddress || {};
  const address = lead.agentAddressSnapshot || lead.address || {};
  const agentSnapshot = lead.agentSnapshot || {};

  return {
    state: clean(snapshot.state || address.state || agentSnapshot.state || lead.agentState || lead.travelAgentState),
    city: clean(snapshot.city || address.city || agentSnapshot.city || lead.agentCity || lead.travelAgentCity),
    subArea: clean(snapshot.subArea || snapshot.area || address.subArea || address.area || agentSnapshot.subArea || lead.agentSubArea),
    pincode: clean(snapshot.pincode || address.pincode || agentSnapshot.pincode || lead.agentPincode),
    line1: clean(snapshot.line1 || address.line1),
    line2: clean(snapshot.line2 || address.line2),
    country: clean(snapshot.country || address.country || "India")
  };
}

export function buildLocationOptions(records = [], extractor = getTravelAgentLocationParts, selectedState = "", selectedCity = "") {
  const stateMap = new Map();

  records.forEach(record => {
    const location = extractor(record) || {};
    const state = clean(location.state);
    const city = clean(location.city);
    const subArea = clean(location.subArea);

    if (!state && !city && !subArea) return;
    const stateKey = state || "Unspecified State";
    if (!stateMap.has(stateKey)) stateMap.set(stateKey, new Map());
    const cityMap = stateMap.get(stateKey);
    const cityKey = city || "Unspecified City";
    if (!cityMap.has(cityKey)) cityMap.set(cityKey, new Set());
    if (subArea) cityMap.get(cityKey).add(subArea);
  });

  const states = Array.from(stateMap.keys()).sort((a, b) => a.localeCompare(b));
  const citySet = new Set();
  const subAreaSet = new Set();

  stateMap.forEach((cityMap, state) => {
    if (selectedState && normalize(state) !== normalize(selectedState)) return;
    cityMap.forEach((areas, city) => {
      citySet.add(city);
      if (selectedCity && normalize(city) !== normalize(selectedCity)) return;
      areas.forEach(area => subAreaSet.add(area));
    });
  });

  return {
    states,
    cities: Array.from(citySet).sort((a, b) => a.localeCompare(b)),
    subAreas: Array.from(subAreaSet).sort((a, b) => a.localeCompare(b))
  };
}

export function matchesLocation(location = {}, { state = "", city = "", subArea = "" } = {}) {
  if (state && normalize(location.state) !== normalize(state)) return false;
  if (city && normalize(location.city) !== normalize(city)) return false;
  if (subArea && normalize(location.subArea) !== normalize(subArea)) return false;
  return true;
}

export function formatLocationParts(location = {}) {
  return [location.subArea, location.city, location.state].filter(Boolean).join(", ") || "Location not added";
}
