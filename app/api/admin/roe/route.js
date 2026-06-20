import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PROVIDER = "frankfurter";
const BASE_URL = "https://api.frankfurter.dev/v1";

function cleanCurrency(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
}

function cleanDate(value) {
  const date = String(value || "").trim();

  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";

  return date;
}

function toNumber(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

async function fetchFrankfurterRate({ from, to, date }) {
  const endpoint = date ? `/${date}` : "/latest";

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("base", from);
  url.searchParams.set("symbols", to);

  const response = await fetch(url.toString(), {
    next: {
      revalidate: date ? 60 * 60 * 24 * 30 : 60 * 60 * 6
    }
  });

  if (!response.ok) {
    throw new Error(`ROE provider failed with status ${response.status}`);
  }

  const data = await response.json();
  const rate = Number(data?.rates?.[to]);

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Rate not available for ${from} to ${to}`);
  }

  return {
    rate,
    providerDate: data.date || date || new Date().toISOString().slice(0, 10)
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const from = cleanCurrency(searchParams.get("from"));
    const to = cleanCurrency(searchParams.get("to") || "INR");
    const date = cleanDate(searchParams.get("date"));
    const amount = toNumber(searchParams.get("amount"), 1);

    if (!from) {
      return NextResponse.json(
        {
          ok: false,
          message: "Missing from currency."
        },
        { status: 400 }
      );
    }

    if (!to) {
      return NextResponse.json(
        {
          ok: false,
          message: "Missing to currency."
        },
        { status: 400 }
      );
    }

    if (from === to) {
      return NextResponse.json({
        ok: true,
        provider: PROVIDER,
        fromCurrency: from,
        toCurrency: to,
        requestedDate: date || "latest",
        providerDate: date || new Date().toISOString().slice(0, 10),
        apiRate: 1,
        finalRate: 1,
        amount,
        convertedAmount: amount,
        source: "same_currency"
      });
    }

    const result = await fetchFrankfurterRate({
      from,
      to,
      date
    });

    return NextResponse.json({
      ok: true,
      provider: PROVIDER,
      fromCurrency: from,
      toCurrency: to,
      requestedDate: date || "latest",
      providerDate: result.providerDate,
      apiRate: result.rate,
      finalRate: result.rate,
      amount,
      convertedAmount: Number((amount * result.rate).toFixed(2)),
      source: "api"
    });
  } catch (error) {
    console.error("ROE API error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: error.message || "Unable to fetch exchange rate."
      },
      { status: 500 }
    );
  }
}