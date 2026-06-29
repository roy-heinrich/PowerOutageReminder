import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Aklan Electric Cooperative Notices</title>
    <link>https://example.com/akelandco</link>
    <description>Mock feed for scheduled power interruptions in Aklan</description>
    <item>
      <title>SCHEDULED POWER INTERRUPTION IN KALIBO AND NUMANCIA</title>
      <link>https://example.com/notices/text-outage</link>
      <guid>https://example.com/notices/text-outage</guid>
      <description><![CDATA[
        Please be advised of a scheduled power interruption on June 30, 2026.
        Time: 8:00 AM - 5:00 PM
        Reason: Pole replacement and line clearing.
        Affected Areas: Kalibo (Brgy. Andagao, Brgy. Estancia) and Numancia (Brgy. Bulwang).
      ]]></description>
      <pubDate>Mon, 29 Jun 2026 08:00:00 +0800</pubDate>
    </item>
    <item>
      <title>AKELCO Split-Schedule Maintenance Notice (Infographic)</title>
      <link>https://example.com/notices/image-outage</link>
      <guid>https://example.com/notices/image-outage</guid>
      <description><![CDATA[
        See attached infographic for details.
        <img src="https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=800" />
      ]]></description>
      <pubDate>Mon, 29 Jun 2026 09:00:00 +0800</pubDate>
    </item>
    <item>
      <title>Regular Advisory: Main Office Hours Update</title>
      <link>https://example.com/notices/regular-advisory</link>
      <guid>https://example.com/notices/regular-advisory</guid>
      <description><![CDATA[
        Our main office in Kalibo will open at 9:00 AM this Friday due to staff training. Thank you.
      ]]></description>
      <pubDate>Mon, 29 Jun 2026 07:00:00 +0800</pubDate>
    </item>
  </channel>
</rss>`;

function extractImageUrl(item: any): string | null {
  if (item.enclosure?.url && item.enclosure.type?.startsWith("image/")) {
    return item.enclosure.url;
  }

  const content = item.content || item.description || "";
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/i;
  const match = content.match(imgRegex);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

async function fetchImageAsBase64(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to fetch image: ${res.status} ${res.statusText}`);
      return null;
    }
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const base64 = Buffer.from(buffer).toString("base64");
    return {
      data: base64,
      mimeType: contentType
    };
  } catch (err) {
    console.error("Error fetching image for base64 conversion:", err);
    return null;
  }
}

function classifyWithKeywords(title: string, rawText: string): boolean {
  const combined = `${title} ${rawText}`.toLowerCase();
  const keywords = [
    "power interruption",
    "scheduled maintenance",
    "outage",
    "abiso",
    "patay-sinto",
    "brownout",
    "interruption",
    "maintenance work",
    "maintenance schedule",
    "line clearing"
  ];
  return keywords.some((keyword) => combined.includes(keyword));
}

// Fallback text parser (modified to support multiple time windows / split-schedules in text)
function parseOutageDetailsRegex(title: string, rawText: string) {
  const combinedText = `${title} \n ${rawText}`;

  let outageDate: Date | null = null;
  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];
  const monthsAbbr = [
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"
  ];

  const wordDatePattern = new RegExp(
    `\\b(${months.join("|")}|${monthsAbbr.join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`,
    "i"
  );
  const wordDatePattern2 = new RegExp(
    `\\b(\\d{1,2})\\s+(${months.join("|")}|${monthsAbbr.join("|")})(?:\\s+(\\d{4}))?\\b`,
    "i"
  );
  const numericDatePattern = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})\b/;

  let match = combinedText.match(wordDatePattern);
  if (match) {
    const monthStr = match[1].toLowerCase();
    const day = parseInt(match[2], 10);
    const currentYear = new Date().getFullYear();
    const year = match[3] ? parseInt(match[3], 10) : currentYear;
    
    let monthIndex = months.indexOf(monthStr);
    if (monthIndex === -1) monthIndex = monthsAbbr.indexOf(monthStr);
    
    if (monthIndex !== -1 && day >= 1 && day <= 31) {
      outageDate = new Date(year, monthIndex, day, 12, 0, 0);
    }
  } else {
    match = combinedText.match(wordDatePattern2);
    if (match) {
      const day = parseInt(match[1], 10);
      const monthStr = match[2].toLowerCase();
      const currentYear = new Date().getFullYear();
      const year = match[3] ? parseInt(match[3], 10) : currentYear;

      let monthIndex = months.indexOf(monthStr);
      if (monthIndex === -1) monthIndex = monthsAbbr.indexOf(monthStr);

      if (monthIndex !== -1 && day >= 1 && day <= 31) {
        outageDate = new Date(year, monthIndex, day, 12, 0, 0);
      }
    } else {
      match = combinedText.match(numericDatePattern);
      if (match) {
        let val1 = parseInt(match[1], 10);
        let val2 = parseInt(match[2], 10);
        let yearVal = parseInt(match[3], 10);
        if (yearVal < 100) yearVal += 2000;

        let month = val1;
        let day = val2;
        if (val1 > 12 && val2 <= 12) {
          month = val2;
          day = val1;
        }
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          outageDate = new Date(yearVal, month - 1, day, 12, 0, 0);
        }
      }
    }
  }

  // Parse time windows
  const timeWindows: { start: string; end: string }[] = [];
  const standardTimePattern = /(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*(?:-|to|until)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))/gi;
  
  let timeMatch;
  while ((timeMatch = standardTimePattern.exec(combinedText)) !== null) {
    timeWindows.push({
      start: timeMatch[1].trim(),
      end: timeMatch[2].trim()
    });
  }

  // Fallback to military pattern if nothing found
  if (timeWindows.length === 0) {
    const militaryTimePattern = /\b(\d{4})H?\s*(?:-|to)\s*(\d{4})H?\b/gi;
    let milMatch;
    while ((milMatch = militaryTimePattern.exec(combinedText)) !== null) {
      const formatMilitary = (mil: string) => {
        const hr = parseInt(mil.substring(0, 2), 10);
        const min = mil.substring(2, 4);
        const ampm = hr >= 12 ? "PM" : "AM";
        const displayHr = hr % 12 === 0 ? 12 : hr % 12;
        return `${displayHr}:${min} ${ampm}`;
      };
      timeWindows.push({
        start: formatMilitary(milMatch[1]),
        end: formatMilitary(milMatch[2])
      });
    }
  }

  // Fallback default single window if still empty
  if (timeWindows.length === 0) {
    timeWindows.push({ start: "8:00 AM", end: "5:00 PM" });
  }

  const aklanMunicipalities = [
    "Altavas", "Balete", "Banga", "Batan", "Buruanga", "Ibajay", "Kalibo", 
    "Lezo", "Libacao", "Madalag", "Makato", "Malay", "Malinao", "Nabas", 
    "New Washington", "Numancia", "Tangalan"
  ];
  
  const areasSet = new Set<string>();
  const substationsSet = new Set<string>();

  // Extract substations
  const substationRegex = /([A-Z][a-zA-Z\s]+Substation)/g;
  let subMatch;
  while ((subMatch = substationRegex.exec(combinedText)) !== null) {
    substationsSet.add(subMatch[1].trim());
  }

  for (const mun of aklanMunicipalities) {
    const munRegex = new RegExp(`\\b${mun}\\b`, "i");
    if (munRegex.test(combinedText)) {
      areasSet.add(mun);
    }
  }

  const brgyPattern = /(?:Brgy\.?|Barangay)\s+([A-Z][a-zA-Z0-9\s]+?)(?:,|\.|\n|and|affected|$)/g;
  let brgyMatch;
  brgyPattern.lastIndex = 0;
  while ((brgyMatch = brgyPattern.exec(combinedText)) !== null) {
    const brgyName = brgyMatch[1].trim();
    if (brgyName.length > 2 && brgyName.length < 30 && /^[A-Z]/.test(brgyName)) {
      areasSet.add(brgyName);
    }
  }

  return {
    outageDate,
    timeWindows,
    substations: Array.from(substationsSet),
    areasAffected: Array.from(areasSet)
  };
}

async function queryVisionAI(imageBase64: { data: string; mimeType: string }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY is not configured.");
    return null;
  }

  const prompt = `
You are an expert power outage infographic parser. Read the text inside this image and extract the outage details.
Analyze the image and determine if it represents a power outage, scheduled maintenance, or power interruption notice for Aklan, Philippines.

Return a JSON object matching this schema:
{
  "isOutage": boolean, // true if it represents a scheduled outage notice
  "outageDate": "YYYY-MM-DD" or null, // The target date of the outage (use 2026 as the default year if year is omitted or unclear)
  "timeWindows": [{"start": "HH:MM AM/PM", "end": "HH:MM AM/PM"}], // Array of all time windows, support split-schedule outages
  "substations": string[], // Affected substation areas, e.g., ["Nabas Substation", "Lezo Substation"]
  "areasAffected": string[] // List of specific municipalities/barangays affected in Aklan
}

Example format values:
- Date: "2026-06-28"
- Time Windows: [{"start": "5:00 AM", "end": "7:00 AM"}, {"start": "4:00 PM", "end": "6:00 PM"}]
- Substations: ["Nabas Substation", "Lezo Substation"]
- Areas Affected: ["Altavas", "Kalibo", "Lezo", "Nabas", "Ibajay", "Tangalan", "Makato", "Numancia", "Malinao", "Banga", "Libacao", "Madalag", "Batan", "Balete", "New Washington"]
`;

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "qwen/qwen3.6-27b",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${imageBase64.mimeType};base64,${imageBase64.data}`
                  }
                }
              ]
            }
          ],
          response_format: {
            type: "json_object"
          },
          temperature: 0.1
        })
      }
    );

    if (!response.ok) {
      console.error("Groq Vision API call failed:", await response.text());
      return null;
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content;
    if (!responseText) return null;

    return JSON.parse(responseText.trim()) as {
      isOutage: boolean;
      outageDate: string | null;
      timeWindows: { start: string; end: string }[];
      substations: string[];
      areasAffected: string[];
    };
  } catch (error) {
    console.error("Error in Groq Vision AI query:", error);
    return null;
  }
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    const rssBridgeUrl = process.env.RSS_BRIDGE_URL;
    let xmlContent = "";

    if (!rssBridgeUrl) {
      console.info("RSS_BRIDGE_URL environment variable is not configured. Falling back to mock RSS XML data.");
      xmlContent = mockXml;
    } else {
      const fetchResponse = await fetch(rssBridgeUrl);
      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch RSS-Bridge: ${fetchResponse.status} ${fetchResponse.statusText}`);
      }
      xmlContent = await fetchResponse.text();
    }

    const parser = new Parser();
    const feed = await parser.parseString(xmlContent);
    const processedItems = [];

    for (const item of feed.items) {
      if (!item.link) continue;

      const existing = await prisma.outage.findUnique({
        where: { url: item.link }
      });

      if (existing) {
        continue;
      }

      const title = item.title || "";
      const rawText = item.content || item.description || "";
      const cleanText = rawText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const imageUrl = extractImageUrl(item);

      let isOutage = false;
      let outageDate: Date | null = null;
      let timeWindows: { start: string; end: string }[] = [];
      let substations: string[] = [];
      let areasAffected: string[] = [];

      // Developer Simulation flow for local mock testing
      if (item.link === "https://example.com/notices/image-outage") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0];

        isOutage = true;
        outageDate = new Date(tomorrowStr + "T12:00:00.000Z");
        timeWindows = [
          { start: "5:00 AM", end: "7:00 AM" },
          { start: "4:00 PM", end: "6:00 PM" }
        ];
        substations = ["Nabas Substation", "Kalibo Substation"];
        areasAffected = ["Nabas", "Kalibo", "Ibajay", "Andagao", "Poblacion"];
      } else if (imageUrl && process.env.GROQ_API_KEY) {
        // Run real Vision AI parsing
        console.info(`Found image URL: ${imageUrl}. Querying Groq Vision AI...`);
        const base64Image = await fetchImageAsBase64(imageUrl);
        if (base64Image) {
          const visionResult = await queryVisionAI(base64Image);
          if (visionResult) {
            isOutage = visionResult.isOutage;
            if (visionResult.outageDate) {
              outageDate = new Date(visionResult.outageDate);
            }
            timeWindows = visionResult.timeWindows;
            substations = visionResult.substations;
            areasAffected = visionResult.areasAffected;
          }
        }
      }

      // Fallback to text parser if no image was found, or if the Vision AI failed/was unconfigured
      if (!isOutage && timeWindows.length === 0) {
        isOutage = classifyWithKeywords(title, cleanText);
        const textResult = parseOutageDetailsRegex(title, cleanText);
        outageDate = textResult.outageDate;
        timeWindows = textResult.timeWindows;
        substations = textResult.substations;
        areasAffected = textResult.areasAffected;
      }

      const status = isOutage ? "SCHEDULED" : "FILTERED_OUT";

      const created = await prisma.outage.create({
        data: {
          title,
          rawText: cleanText,
          imageUrl,
          url: item.link,
          outageDate,
          timeWindows,
          substations,
          areasAffected,
          status
        }
      });

      processedItems.push({
        id: created.id,
        title: created.title,
        status: created.status,
        imageUrl: created.imageUrl,
        outageDate: created.outageDate,
        timeWindows: created.timeWindows,
        substations: created.substations,
        areasAffected: created.areasAffected
      });
    }

    return NextResponse.json({
      success: true,
      processedCount: processedItems.length,
      items: processedItems
    });
  } catch (error: any) {
    console.error("Error in fetch-outages route:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
