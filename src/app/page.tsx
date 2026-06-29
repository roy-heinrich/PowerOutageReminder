import { prisma } from "@/lib/db";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  let outages: any[] = [];

  try {
    outages = await prisma.outage.findMany({
      orderBy: { processedAt: "desc" }
    });

    outages = outages.map((o) => ({
      ...o,
      outageDate: o.outageDate ? o.outageDate.toISOString() : null,
      processedAt: o.processedAt.toISOString()
    }));
  } catch (err) {
    console.warn("Failed to query Neon Postgres, loading fallback preview data. Error details:", err);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    outages = [
      {
        id: "mock-split-outage",
        title: "AKELCO Split-Schedule Maintenance Notice (Vision Ingested)",
        rawText: "Scheduled power interruption notice ingested via infographic scan. Maintenance work on pole replacements.",
        imageUrl: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=800",
        url: "https://example.com/notices/image-outage",
        outageDate: tomorrow.toISOString(),
        timeWindows: [
          { start: "5:00 AM", end: "7:00 AM" },
          { start: "4:00 PM", end: "6:00 PM" }
        ],
        substations: ["Nabas Substation", "Kalibo Substation"],
        areasAffected: ["Nabas", "Kalibo", "Ibajay", "Andagao", "Poblacion"],
        status: "SCHEDULED",
        processedAt: new Date().toISOString()
      },
      {
        id: "mock-text-outage",
        title: "SCHEDULED POWER INTERRUPTION IN NUMANCIA",
        rawText: "Please be advised of a scheduled power interruption on " + tomorrow.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) + ". Time: 8:00 AM - 5:00 PM. Affected Areas: Numancia (Brgy. Bulwang).",
        imageUrl: null,
        url: "https://example.com/notices/text-outage",
        outageDate: tomorrow.toISOString(),
        timeWindows: [
          { start: "8:00 AM", end: "5:00 PM" }
        ],
        substations: [],
        areasAffected: ["Numancia", "Bulwang"],
        status: "SCHEDULED",
        processedAt: new Date().toISOString()
      },
      {
        id: "mock-office-advisory",
        title: "Regular Advisory: Main Office Hours Update",
        rawText: "Our main office in Kalibo will open at 9:00 AM this Friday due to staff training. Thank you.",
        imageUrl: null,
        url: "https://example.com/notices/regular-advisory",
        outageDate: null,
        timeWindows: [],
        substations: [],
        areasAffected: [],
        status: "FILTERED_OUT",
        processedAt: new Date().toISOString()
      }
    ];
  }

  return <Dashboard initialOutages={outages} />;
}
