import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await sendTelegramMessage(
      `✅ <b>Test Notification</b>\n\nYour Aklan Outage Notifier Telegram integration is working correctly!\n\n<i>Sent at ${new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", dateStyle: "full", timeStyle: "short" })}</i>`
    );

    if (result.ok) {
      return NextResponse.json({ success: true, message: "Test message sent successfully." });
    } else {
      return NextResponse.json(
        { success: false, error: result.description || "Telegram API returned an error." },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error sending test Telegram message:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
