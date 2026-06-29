import type { NextConfig } from "next";
import os from "os";

// Dynamically discover all local network IPs to support HMR/WebSockets
// when accessing the site via LAN (e.g. from other devices or custom IPs).
const getLocalIPs = (): string[] => {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const netInterface = interfaces[name];
    if (netInterface) {
      for (const net of netInterface) {
        if (!net.internal) {
          ips.push(net.address);
        }
      }
    }
  }
  return ips;
};

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: getLocalIPs(),
};

export default nextConfig;
