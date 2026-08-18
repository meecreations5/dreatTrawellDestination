import { createEmptyActivityPricing } from "./destinationPricing";

function createId(prefix = "id") {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function createEmptyActivity() {
  return {
    id: createId("activity"),

    title: "",
    description: "",
    activityType: "shared_tour",

    media: [],

    timing: {
      duration: "",
      startTime: "",
      endTime: "",
      pickupRequired: false,
      pickupTime: "",
      dropTime: "",
      operatingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      blackoutDates: []
    },

    pricing: createEmptyActivityPricing(),

    vendor: {
      vendorId: "",
      vendorName: "",
      contactPerson: "",
      phone: "",
      email: "",
      paymentTerms: "",
      cancellationPolicy: ""
    },

    inclusions: [],
    exclusions: [],
    cancellationPolicy: "",
    internalNotes: "",

    featured: false,
    active: true,
    order: 1
  };
}

export function createEmptyLocation() {
  return {
    id: createId("location"),

    type: "city",
    name: "",
    order: 1,
    recommendedNights: "",
    shortDescription: "",

    coverPhoto: null,
    mediaGallery: [],

    activities: [],
    attractions: [],
    placesToVisit: [],
    foodCulture: [],

    hotelAreas: [],
    transferNotes: "",
    internalNotes: "",

    active: true
  };
}

export const DESTINATION_FORM_DEFAULTS = {
  destinationId: "",
  name: "",
  code: "",

  shortDescription: "",
  description: "",

  bestTimeToVisit: "",
  idealTripDuration: "",
  destinationType: "international",

  travelStyles: {
    family: false,
    couple: false,
    luxury: false,
    adventure: false
  },

  hasSubLocations: false,
  locationLabel: "Locations",

  coverPhoto: null,
  gallery: [],
  mediaGallery: [],

  activities: [],
  attractions: [],
  placesToVisit: [],
  foodCulture: [],

  locations: [],

  channels: [],
  salesPartners: [],
  bookingPartners: [],

  seo: {
    slug: "",
    title: "",
    description: "",
    keywords: [],
    ogImage: null,
    indexable: true,
    canonicalUrl: ""
  },

  faqs: [],

  status: "draft",
  active: true
};

export function normalizeDestinationForm(data = {}) {
  return {
    ...DESTINATION_FORM_DEFAULTS,
    ...data,

    travelStyles: {
      ...DESTINATION_FORM_DEFAULTS.travelStyles,
      ...(data.travelStyles || {})
    },

    hasSubLocations: Boolean(data.hasSubLocations),
    locationLabel: data.locationLabel || "Locations",

    gallery: Array.isArray(data.gallery) ? data.gallery : [],
    mediaGallery: Array.isArray(data.mediaGallery) ? data.mediaGallery : [],

    activities: Array.isArray(data.activities) ? data.activities : [],
    attractions: Array.isArray(data.attractions) ? data.attractions : [],
    placesToVisit: Array.isArray(data.placesToVisit)
      ? data.placesToVisit
      : [],
    foodCulture: Array.isArray(data.foodCulture) ? data.foodCulture : [],

    locations: Array.isArray(data.locations) ? data.locations : [],

    channels: Array.isArray(data.channels) ? data.channels : [],
    salesPartners: Array.isArray(data.salesPartners)
      ? data.salesPartners
      : [],
    bookingPartners: Array.isArray(data.bookingPartners)
      ? data.bookingPartners
      : [],

    seo: {
      ...DESTINATION_FORM_DEFAULTS.seo,
      ...(data.seo || {})
    },

    faqs: Array.isArray(data.faqs) ? data.faqs : []
  };
}