import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface TimeWindow {
  start: string;
  end: string;
}

// Stub notification dispatcher
async function sendNotification(
  subscriber: { email: string | null; phoneNumber: string | null; areaOfInterest: string },
  outage: { title: string; outageDate: Date | null; timeWindows: any; substations: string[]; areasAffected: string[] }
) {
  const dateStr = outage.outageDate ? new Date(outage.outageDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }) : "Unknown Date";

  // Parse split-schedule time windows
  const windows = (outage.timeWindows as TimeWindow[]) || [];
  const timeStr = windows.length > 0 
    ? windows.map((w) => `${w.start} to ${w.end}`).join(" and ")
    : "TBD";

  const message = `Aklan Power Alert: Scheduled interruption affecting your zone (${subscriber.areaOfInterest}) on ${dateStr} during ${timeStr}. Affected Substations: ${outage.substations.join(", ") || "None"}. Affected Areas: ${outage.areasAffected.join(", ")}.`;

  console.log(`[STUB ALERT SENT]
    Recipient: ${subscriber.email ? `Email: ${subscriber.email}` : `SMS: ${subscriber.phoneNumber}`}
    Area of Interest: ${subscriber.areaOfInterest}
    Message: "${message}"
  `);

  /**
   * PRODUCTION READY INTEGRATIONS
   * (Uncomment and configure if environment variables are set)
   * 
   * // 1. Resend (Email Alert)
   * if (subscriber.email && process.env.RESEND_API_KEY) {
   *   try {
   *     await fetch("https://api.resend.com/emails", {
   *       method: "POST",
   *       headers: {
   *         "Content-Type": "application/json",
   *         "Authorization": `Bearer ${process.env.RESEND_API_KEY}`
   *       },
   *       body: JSON.stringify({
   *         from: "Aklan Power Alerts <outages@yourdomain.com>",
   *         to: subscriber.email,
   *         subject: `24-Hour Notice: Scheduled Power Interruption in ${subscriber.areaOfInterest}`,
   *         html: `<div style="font-family: sans-serif; padding: 20px; border-radius: 8px; border: 1px solid #eaeaea;">
   *                  <h2 style="color: #dd6b20;">Power Interruption Advisory</h2>
   *                  <p>Hello,</p>
   *                  <p>This is a 24-hour advance notice regarding a scheduled power interruption in Aklan affecting your zone.</p>
   *                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
   *                    <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Date:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${dateStr}</td></tr>
   *                    <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Time Windows:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${timeStr}</td></tr>
   *                    <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Substations:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${outage.substations.join(", ") || "None"}</td></tr>
   *                    <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Affected Areas:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${outage.areasAffected.join(", ")}</td></tr>
   *                  </table>
   *                  <p>Please prepare accordingly.</p>
   *                </div>`
   *       })
   *     });
   *   } catch (err) {
   *     console.error("Failed to send email via Resend:", err);
   *   }
   * }
   */
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    const now = new Date();
    // 24 hours away range: between 23 hours and 25 hours from now
    const minTarget = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const maxTarget = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Fetch upcoming scheduled outages that haven't been notified yet
    const upcomingOutages = await prisma.outage.findMany({
      where: {
        status: "SCHEDULED",
        reminderSent: false,
        outageDate: {
          gte: minTarget,
          lte: maxTarget
        }
      }
    });

    if (upcomingOutages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No outages scheduled exactly 24 hours away. No reminders sent.",
        sentCount: 0
      });
    }

    // Fetch all subscribers to filter in-memory (handles case-insensitive, town-level, and substation matches)
    const subscribers = await prisma.subscriber.findMany();
    let totalNotificationsSent = 0;
    const sentAlertsDetails = [];

    for (const outage of upcomingOutages) {
      // Find matching subscribers by town name OR substation name
      const matchedSubscribers = subscribers.filter((sub) => {
        const subArea = sub.areaOfInterest.toLowerCase().trim();
        
        const matchArea = outage.areasAffected.some((outageArea) => {
          const oArea = outageArea.toLowerCase().trim();
          return subArea.includes(oArea) || oArea.includes(subArea);
        });

        const matchSubstation = outage.substations.some((substation) => {
          const sName = substation.toLowerCase().trim();
          return subArea.includes(sName) || sName.includes(subArea);
        });

        return matchArea || matchSubstation;
      });

      // Dispatch notifications to matched subscribers
      for (const subscriber of matchedSubscribers) {
        await sendNotification(subscriber, outage);
        totalNotificationsSent++;
        sentAlertsDetails.push({
          subscriberId: subscriber.id,
          outageId: outage.id,
          recipient: subscriber.email || subscriber.phoneNumber,
          area: subscriber.areaOfInterest
        });
      }

      // Mark the outage reminder as sent so we don't repeat notifications
      await prisma.outage.update({
        where: { id: outage.id },
        data: { reminderSent: true }
      });
    }

    return NextResponse.json({
      success: true,
      outagesNotifiedCount: upcomingOutages.length,
      notificationsDispatchedCount: totalNotificationsSent,
      alerts: sentAlertsDetails
    });
  } catch (error: any) {
    console.error("Error in send-reminders route:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
