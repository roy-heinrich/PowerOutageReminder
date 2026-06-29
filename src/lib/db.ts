import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

// Set up WebSocket constructor for Neon serverless queries in Node
if (typeof window === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const getPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("DATABASE_URL is not set. database client is initialized with placeholder configuration.");
    const dummyAdapter = new PrismaNeon({ connectionString: "postgresql://dummy:dummy@localhost:5432/dummy" });
    return new PrismaClient({ adapter: dummyAdapter });
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
};

export const prisma = globalForPrisma.prisma || getPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
