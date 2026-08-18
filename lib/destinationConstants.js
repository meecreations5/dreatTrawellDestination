export const DESTINATION_TYPES = [
  { value: "domestic", label: "Domestic" },
  { value: "international", label: "International" }
];

export const DESTINATION_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" }
];

export const ACTIVITY_STRUCTURE_TYPES = [
  {
    value: "destination_level",
    label: "Activities directly under destination",
    description: "Best for Maldives, Dubai, Singapore, or single-city destinations."
  },
  {
    value: "location_wise",
    label: "Manage by city / island / region",
    description: "Best for Thailand, Europe, Vietnam, Japan, or multi-location trips."
  }
];

export const LOCATION_TYPES = [
  { value: "city", label: "City" },
  { value: "island", label: "Island" },
  { value: "region", label: "Region" },
  { value: "province", label: "Province" },
  { value: "resort_area", label: "Resort Area" },
  { value: "atoll", label: "Atoll" },
  { value: "area", label: "Area" },
  { value: "other", label: "Other" }
];

export const ACTIVITY_TYPES = [
  { value: "shared_tour", label: "Shared Tour" },
  { value: "private_tour", label: "Private Tour" },
  { value: "ticket", label: "Ticket" },
  { value: "transfer", label: "Transfer" },
  { value: "combo", label: "Combo" },
  { value: "cruise", label: "Cruise" },
  { value: "adventure", label: "Adventure" },
  { value: "water_activity", label: "Water Activity" },
  { value: "theme_park", label: "Theme Park" },
  { value: "sightseeing", label: "Sightseeing" },
  { value: "guide_service", label: "Guide Service" },
  { value: "other", label: "Other" }
];

export const PRICE_UNITS = [
  { value: "per_person", label: "Per Person" },
  { value: "per_adult", label: "Per Adult" },
  { value: "per_child", label: "Per Child" },
  { value: "per_infant", label: "Per Infant" },
  { value: "per_vehicle", label: "Per Vehicle" },
  { value: "per_group", label: "Per Group" },
  { value: "per_booking", label: "Per Booking" },
  { value: "per_hour", label: "Per Hour" },
  { value: "per_guide", label: "Per Guide" }
];

export const MARKUP_TYPES = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed INR" }
];

export const OPERATING_DAYS = [
  { value: "Mon", label: "Mon" },
  { value: "Tue", label: "Tue" },
  { value: "Wed", label: "Wed" },
  { value: "Thu", label: "Thu" },
  { value: "Fri", label: "Fri" },
  { value: "Sat", label: "Sat" },
  { value: "Sun", label: "Sun" }
];

export const SUPPORTED_CURRENCIES = [
  { value: "INR", label: "INR - Indian Rupee", symbol: "₹" },
  { value: "USD", label: "USD - US Dollar", symbol: "$" },
  { value: "EUR", label: "EUR - Euro", symbol: "€" },
  { value: "GBP", label: "GBP - British Pound", symbol: "£" },
  { value: "AED", label: "AED - UAE Dirham", symbol: "د.إ" },
  { value: "THB", label: "THB - Thai Baht", symbol: "฿" },
  { value: "SGD", label: "SGD - Singapore Dollar", symbol: "S$" },
  { value: "MYR", label: "MYR - Malaysian Ringgit", symbol: "RM" },
  { value: "IDR", label: "IDR - Indonesian Rupiah", symbol: "Rp" },
  { value: "VND", label: "VND - Vietnamese Dong", symbol: "₫" },
  { value: "JPY", label: "JPY - Japanese Yen", symbol: "¥" },
  { value: "AUD", label: "AUD - Australian Dollar", symbol: "A$" },
  { value: "CHF", label: "CHF - Swiss Franc", symbol: "CHF" },
  { value: "MUR", label: "MUR - Mauritian Rupee", symbol: "₨" },
  { value: "ZAR", label: "ZAR - South African Rand", symbol: "R" }
];

export const MEDIA_TYPES = [
  { value: "image", label: "Photo" },
  { value: "video", label: "Video" }
];

export const MEDIA_SOURCES = [
  { value: "upload", label: "Upload" },
  { value: "youtube", label: "YouTube" }
];