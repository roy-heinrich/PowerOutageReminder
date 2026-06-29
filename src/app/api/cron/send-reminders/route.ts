import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendOutageAlert } from "@/lib/telegram";

export const runtime = "nodejs";

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

    let totalNotificationsSent = 0;
    const sentAlertsDetails = [];

    for (const outage of upcomingOutages) {
      // Send Telegram notification for each upcoming outage
      const timeWindows = (outage.timeWindows as { start: string; end: string }[]) || [];

      const result = await sendOutageAlert({
        title: outage.title,
        outageDate: outage.outageDate,
        timeWindows,
        substations: outage.substations,
        areasAffected: outage.areasAffected
      });

      if (result.ok) {
        totalNotificationsSent++;
        sentAlertsDetails.push({
          outageId: outage.id,
          title: outage.title,
          telegramSent: true
        });
      } else {
        sentAlertsDetails.push({
          outageId: outage.id,
          title: outage.title,
          telegramSent: false,
          error: result.description
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
      telegramMessagesSent: totalNotificationsSent,
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
