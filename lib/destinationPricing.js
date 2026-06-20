export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function roundMoney(value, decimals = 2) {
  const number = toNumber(value);
  const factor = Math.pow(10, decimals);
  return Math.round(number * factor) / factor;
}

export function calculateInrAmount(amount, roeToInr) {
  const baseAmount = toNumber(amount);
  const roe = toNumber(roeToInr);

  if (baseAmount <= 0 || roe <= 0) return 0;

  return roundMoney(baseAmount * roe);
}

export function calculateSellingPrice(amountInInr, markupType, markupValue) {
  const cost = toNumber(amountInInr);
  const markup = toNumber(markupValue);

  if (cost <= 0) return 0;

  if (markupType === "fixed") {
    return roundMoney(cost + markup);
  }

  return roundMoney(cost + (cost * markup) / 100);
}

function calculatePassengerPricing({
  passenger,
  fallbackLabel,
  fallbackMinAge,
  fallbackMaxAge,
  finalRoeToInr,
  defaultMarkupType,
  defaultMarkupValue
}) {
  const amount = toNumber(passenger?.amount);
  const amountInInr = calculateInrAmount(amount, finalRoeToInr);

  const markupType = passenger?.markupType || defaultMarkupType;
  const markupValue =
    passenger?.markupValue !== undefined
      ? toNumber(passenger.markupValue)
      : defaultMarkupValue;

  const sellingInInr = calculateSellingPrice(
    amountInInr,
    markupType,
    markupValue
  );

  return {
    ...(passenger || {}),
    label: passenger?.label || fallbackLabel,
    minAge: passenger?.minAge ?? fallbackMinAge,
    maxAge: passenger?.maxAge ?? fallbackMaxAge,
    amount,
    amountInInr,
    markupType,
    markupValue,
    sellingInInr
  };
}

export function calculateActivityPricing(pricing = {}) {
  const currency = pricing.currency || "USD";

  const finalRoeToInr =
    currency === "INR"
      ? 1
      : toNumber(
          pricing.finalRoeToInr ||
            pricing.companyRateToInr ||
            pricing.apiRateToInr ||
            pricing.roeToInr
        );

  const defaultMarkupType = pricing.markupType || "percentage";
  const defaultMarkupValue = toNumber(pricing.markupValue);

  const adult = calculatePassengerPricing({
    passenger: pricing.adult,
    fallbackLabel: "Adult",
    fallbackMinAge: 12,
    fallbackMaxAge: null,
    finalRoeToInr,
    defaultMarkupType,
    defaultMarkupValue
  });

  const child = calculatePassengerPricing({
    passenger: pricing.child,
    fallbackLabel: "Child",
    fallbackMinAge: 2,
    fallbackMaxAge: 11,
    finalRoeToInr,
    defaultMarkupType,
    defaultMarkupValue
  });

  const infant = calculatePassengerPricing({
    passenger: pricing.infant,
    fallbackLabel: "Infant",
    fallbackMinAge: 0,
    fallbackMaxAge: 1,
    finalRoeToInr,
    defaultMarkupType,
    defaultMarkupValue
  });

  return {
    ...pricing,

    priceUnit: pricing.priceUnit || "per_person",
    currency,
    finalRoeToInr,

    markupType: defaultMarkupType,
    markupValue: defaultMarkupValue,

    adult,
    child,
    infant,

    // Backward-compatible values
    sellingAdultInInr: adult.sellingInInr,
    sellingChildInInr: child.sellingInInr,
    sellingInfantInInr: infant.sellingInInr
  };
}

export function createEmptyActivityPricing() {
  const today = new Date().toISOString().slice(0, 10);

  return {
    priceUnit: "per_person",

    currency: "USD",
    roeDate: today,

    apiRateToInr: 0,
    companyRateToInr: 0,
    finalRoeToInr: 0,

    roeProvider: "",
    roeSource: "",
    roeFetchedAt: "",

    markupType: "percentage",
    markupValue: 0,

    adult: {
      label: "Adult",
      minAge: 12,
      maxAge: null,
      amount: 0,
      amountInInr: 0,
      markupType: "percentage",
      markupValue: 0,
      sellingInInr: 0
    },

    child: {
      label: "Child",
      minAge: 2,
      maxAge: 11,
      amount: 0,
      amountInInr: 0,
      markupType: "percentage",
      markupValue: 0,
      sellingInInr: 0
    },

    infant: {
      label: "Infant",
      minAge: 0,
      maxAge: 1,
      amount: 0,
      amountInInr: 0,
      markupType: "percentage",
      markupValue: 0,
      sellingInInr: 0
    },

    sellingAdultInInr: 0,
    sellingChildInInr: 0,
    sellingInfantInInr: 0
  };
}