/**
 * Telegram Bot API utility for sending power outage notifications.
 * Uses native fetch — no external dependencies required.
 */

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

interface TelegramSendResult {
  ok: boolean;
  description?: string;
  result?: any;
}

/**
 * Sends a message to the configured Telegram chat using the Bot API.
 * Uses HTML parse mode for rich formatting.
 */
export async function sendTelegramMessage(text: string): Promise<TelegramSendResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured. Skipping notification.");
    return { ok: false, description: "Telegram credentials not configured" };
  }

  const url = `${TELEGRAM_API_BASE}${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });

    const data: TelegramSendResult = await response.json();

    if (!data.ok) {
      console.error(`[Telegram] API error: ${data.description}`);
    }

    return data;
  } catch (error: any) {
    console.error(`[Telegram] Failed to send message: ${error.message}`);
    return { ok: false, description: error.message };
  }
}

/**
 * Formats and sends a power outage alert via Telegram.
 */
export async function sendOutageAlert(outage: {
  title: string;
  outageDate: Date | null;
  timeWindows: { start: string; end: string }[];
  substations: string[];
  areasAffected: string[];
}): Promise<TelegramSendResult> {
  const dateStr = outage.outageDate
    ? new Date(outage.outageDate).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    : "Unknown Date";

  const timeStr =
    outage.timeWindows.length > 0
      ? outage.timeWindows.map((w) => `${w.start} – ${w.end}`).join("\n         ")
      : "TBD";

  const substationsStr =
    outage.substations.length > 0
      ? outage.substations.join(", ")
      : "None specified";

  const areasStr =
    outage.areasAffected.length > 0
      ? outage.areasAffected.join(", ")
      : "None specified";

  const message = `⚡ <b>POWER OUTAGE ADVISORY</b>

<b>${outage.title}</b>

📅 <b>Date:</b> ${dateStr}
⏰ <b>Time:</b> ${timeStr}
🔌 <b>Substations:</b> ${substationsStr}
📍 <b>Affected Areas:</b> ${areasStr}

<i>This is an automated 24-hour advance notice from the Aklan Outage Notifier.</i>`;

  return sendTelegramMessage(message);
}
