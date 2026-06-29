import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { email, phoneNumber, areaOfInterest } = await request.json();

    if (!areaOfInterest || areaOfInterest.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Area of Interest (Barangay or Municipality) is required." },
        { status: 400 }
      );
    }

    const cleanEmail = email?.trim() || null;
    const cleanPhone = phoneNumber?.trim() || null;

    if (!cleanEmail && !cleanPhone) {
      return NextResponse.json(
        { success: false, error: "Please provide either an Email address or a Phone number for notifications." },
        { status: 400 }
      );
    }

    // Check if subscription already exists for this contact & area to prevent duplicate registrations
    const existing = await prisma.subscriber.findFirst({
      where: {
        AND: [
          { areaOfInterest: { equals: areaOfInterest.trim(), mode: "insensitive" } },
          {
            OR: [
              cleanEmail ? { email: { equals: cleanEmail, mode: "insensitive" } } : undefined,
              cleanPhone ? { phoneNumber: { equals: cleanPhone } } : undefined
            ].filter(Boolean) as any
          }
        ]
      }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "You are already subscribed to alerts for this area." },
        { status: 409 }
      );
    }

    const newSubscriber = await prisma.subscriber.create({
      data: {
        email: cleanEmail,
        phoneNumber: cleanPhone,
        areaOfInterest: areaOfInterest.trim()
      }
    });

    return NextResponse.json({
      success: true,
      message: "Successfully subscribed to power outage alerts!",
      subscriber: newSubscriber
    });
  } catch (error: any) {
    console.error("Error in subscriber signup:", error);
    return NextResponse.json(
      { success: false, error: error.message || "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
