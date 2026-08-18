import { NextResponse } from "next/server";

function isValidIndianPincode(pincode = "") {
  return /^[1-9][0-9]{5}$/.test(String(pincode || "").trim());
}

export async function GET(request, context) {
  try {
    const params = await context.params;
    const pincode = String(params?.pincode || "").trim();

    if (!isValidIndianPincode(pincode)) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter a valid 6-digit Indian pincode.",
          postOffices: []
        },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.postalpincode.in/pincode/${pincode}`,
      {
        method: "GET",
        cache: "no-store"
      }
    );

    const data = await response.json();
    const result = Array.isArray(data) ? data[0] : null;

    if (
      !result ||
      result.Status !== "Success" ||
      !Array.isArray(result.PostOffice)
    ) {
      return NextResponse.json({
        success: false,
        message: result?.Message || "No address found for this pincode.",
        postOffices: []
      });
    }

    const postOffices = result.PostOffice.map(item => ({
      name: item.Name || "",
      branchType: item.BranchType || "",
      deliveryStatus: item.DeliveryStatus || "",
      district: item.District || "",
      division: item.Division || "",
      region: item.Region || "",
      state: item.State || "",
      country: item.Country || "India"
    }));

    return NextResponse.json({
      success: true,
      message: result.Message || "Address found.",
      postOffices
    });
  } catch (error) {
    console.error("Pincode lookup failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch pincode address.",
        postOffices: []
      },
      { status: 500 }
    );
  }
}