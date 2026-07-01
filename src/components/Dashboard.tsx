"use client";

import React, { useState, useMemo } from "react";
import { 
  AlertTriangle, 
  CheckCircle, 
  MapPin, 
  Search, 
  Bell, 
  Clock, 
  Filter, 
  Database,
  RefreshCw,
  Info,
  Image as ImageIcon,
  Send,
  ExternalLink
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TimeWindow {
  start: string;
  end: string;
}

interface Outage {
  id: string;
  title: string;
  rawText: string;
  url: string;
  imageUrl: string | null;
  outageDate: string | null;
  timeWindows: TimeWindow[];
  substations: string[];
  areasAffected: string[];
  status: "SCHEDULED" | "FILTERED_OUT";
  processedAt: string;
}

interface DashboardProps {
  initialOutages: Outage[];
}

export default function Dashboard({ initialOutages }: DashboardProps) {
  const [outages, setOutages] = useState<Outage[]>(initialOutages);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"SCHEDULED" | "FILTERED_OUT">("SCHEDULED");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const stats = useMemo(() => {
    const scheduled = outages.filter((o) => o.status === "SCHEDULED").length;
    const filtered = outages.filter((o) => o.status === "FILTERED_OUT").length;
    return {
      total: outages.length,
      scheduled,
      filtered
    };
  }, [outages]);

  const filteredOutages = useMemo(() => {
    return outages
      .filter((o) => o.status === activeTab)
      .filter((o) => {
        const query = searchTerm.toLowerCase();
        return (
          o.title.toLowerCase().includes(query) ||
          o.rawText.toLowerCase().includes(query) ||
          o.areasAffected.some((area) => area.toLowerCase().includes(query)) ||
          o.substations.some((sub) => sub.toLowerCase().includes(query))
        );
      });
  }, [outages, activeTab, searchTerm]);

  const handleTestTelegram = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/telegram/test", { method: "POST" });
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (response.ok && data.success) {
          setTestResult({ type: "success", text: "Test message sent! Check the Telegram channel." });
        } else {
          setTestResult({ type: "error", text: data.error || "Failed to send test message." });
        }
      } else {
        setTestResult({ type: "error", text: `Failed with status: ${response.status}` });
      }
    } catch (err) {
      console.error(err);
      setTestResult({ type: "error", text: "Connection error. Please try again." });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncFeed = async () => {
    setIsRefreshing(true);
    setRefreshMessage("Running ingestion and Vision parsing...");
    try {
      const response = await fetch("/api/cron/fetch-outages", { method: "POST" });
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (response.ok && data.success) {
          setRefreshMessage(`Successfully ingested ${data.processedCount} new notices!`);
          window.location.reload();
        } else {
          setRefreshMessage(data.error || "No new updates found or fetch failed.");
        }
      } else {
        const responseText = await response.text();
        if (response.status === 401) {
          setRefreshMessage("Unauthorized: Syncing feed from dashboard is disabled in production.");
        } else {
          setRefreshMessage(`Sync failed: ${responseText || `Status ${response.status}`}`);
        }
      }
    } catch (err) {
      console.error(err);
      setRefreshMessage("Failed to connect to ingestion service.");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshMessage(""), 5000);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-zinc-100">
      
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900 sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-zinc-800 border border-zinc-700 p-2 rounded text-zinc-100">
              <AlertTriangle className="h-6 w-6 text-zinc-100" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-100">
                Aklan Outage Notifier
              </h1>
              <p className="text-xs text-zinc-400">Automated 24h Interruption Advisory System</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {refreshMessage && (
              <span className="text-xs bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded text-zinc-300 flex items-center gap-1.5">
                <Info className="h-3 w-3 text-zinc-400" />
                {refreshMessage}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncFeed}
              disabled={isRefreshing}
              className="border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-zinc-100 flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Sync Feed
            </Button>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
              <span className="text-xs text-zinc-400 font-medium">Vision Feed Live</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-8">
        
        {/* Stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border border-zinc-800 rounded">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-400">Active Outages</p>
                <h3 className="text-2xl font-bold text-zinc-100 mt-1">{stats.scheduled}</h3>
              </div>
              <div className="bg-zinc-800/50 p-2.5 rounded border border-zinc-700 text-zinc-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border border-zinc-800 rounded">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-400">Unrelated Filtered</p>
                <h3 className="text-2xl font-bold text-zinc-100 mt-1">{stats.filtered}</h3>
              </div>
              <div className="bg-zinc-800/50 p-2.5 rounded border border-zinc-700 text-zinc-300">
                <Filter className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border border-zinc-800 rounded">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-400">Channel Alerts</p>
                <h3 className="text-2xl font-bold text-emerald-400 mt-1">Connected</h3>
              </div>
              <div className="bg-zinc-800/50 p-2.5 rounded border border-zinc-700 text-zinc-300">
                <Send className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border border-zinc-800 rounded">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-400">Total Ingested</p>
                <h3 className="text-2xl font-bold text-zinc-100 mt-1">{stats.total}</h3>
              </div>
              <div className="bg-zinc-800/50 p-2.5 rounded border border-zinc-700 text-zinc-300">
                <Database className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Telegram Panel */}
          <section className="lg:col-span-1 flex flex-col gap-6">
            <Card className="bg-zinc-900 border border-zinc-800 rounded shadow-none relative overflow-hidden group">
              <CardHeader>
                <CardTitle className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <Send className="h-4 w-4 text-zinc-300" />
                  Telegram Channel
                </CardTitle>
                <CardDescription className="text-zinc-400 text-xs">
                  Power outage alerts are sent to the Telegram channel 24 hours before a scheduled interruption.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Connection Status */}
                <div className="flex items-center gap-3 p-3 rounded bg-zinc-950 border border-zinc-800">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">Bot Connected</p>
                    <p className="text-[11px] text-zinc-500">Notifications will be sent automatically</p>
                  </div>
                </div>

                {/* How It Works */}
                <div className="space-y-2.5">
                  <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">How it works</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5 text-xs text-zinc-400">
                      <div className="bg-zinc-800 rounded p-1 mt-0.5 border border-zinc-700 shrink-0">
                        <Database className="h-3 w-3 text-zinc-300" />
                      </div>
                      <span>RSS feeds are parsed and outages are classified automatically</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-zinc-400">
                      <div className="bg-zinc-800 rounded p-1 mt-0.5 border border-zinc-700 shrink-0">
                        <Clock className="h-3 w-3 text-zinc-300" />
                      </div>
                      <span>24 hours before each outage, a reminder is triggered</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-zinc-400">
                      <div className="bg-zinc-800 rounded p-1 mt-0.5 border border-zinc-700 shrink-0">
                        <Send className="h-3 w-3 text-zinc-300" />
                      </div>
                      <span>Formatted alert is sent to the Telegram channel with all details</span>
                    </div>
                  </div>
                </div>

                {/* Test Button */}
                <Button
                  onClick={handleTestTelegram}
                  disabled={isTesting}
                  className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold transition-colors text-xs py-2.5 rounded"
                >
                  {isTesting ? "Sending..." : "Send Test Message"}
                </Button>

                {testResult && (
                  <div className={`p-3 rounded border text-xs flex items-start gap-2 ${
                    testResult.type === "success" 
                      ? "bg-zinc-800 border-zinc-700 text-emerald-400" 
                      : "bg-zinc-800 border-zinc-700 text-rose-400"
                  }`}>
                    {testResult.type === "success" ? (
                      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                    )}
                    <span>{testResult.text}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-400 p-5 flex flex-col gap-3 rounded">
              <h4 className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-zinc-400" />
                Vision-Powered Advisory System
              </h4>
              <ol className="list-decimal pl-4 space-y-2">
                <li>System automatically parses RSS updates. If image infographics are found, they are processed using **Gemini Vision AI**.</li>
                <li>Vision AI OCR extracts dates, substations, split-schedules, and municipalities.</li>
                <li>Telegram bot sends alerts to the channel 24 hours prior with full outage details.</li>
              </ol>
            </Card>
          </section>

          {/* Outages Log Section */}
          <section className="lg:col-span-2 flex flex-col gap-6">
            
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              {/* Tab toggles */}
              <div className="flex bg-zinc-900 p-1 rounded border border-zinc-800 w-full sm:w-auto">
                <button
                  onClick={() => setActiveTab("SCHEDULED")}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                    activeTab === "SCHEDULED"
                      ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                      : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Scheduled Reminders ({stats.scheduled})
                </button>
                <button
                  onClick={() => setActiveTab("FILTERED_OUT")}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                    activeTab === "FILTERED_OUT"
                      ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                      : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filtered Out ({stats.filtered})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <Input
                  type="text"
                  placeholder="Search outages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 pl-10 focus-visible:ring-zinc-700 focus-visible:ring-1 text-xs rounded"
                />
              </div>
            </div>

            {/* Outage Table */}
            <Card className="bg-zinc-900 border border-zinc-800 shadow-none flex-1 overflow-hidden rounded">
              <CardHeader className="border-b border-zinc-800/80 pb-4">
                <CardTitle className="text-base font-bold text-zinc-200">
                  {activeTab === "SCHEDULED" ? "Ingested Outage Alerts" : "Filtered Non-Outage Logs"}
                </CardTitle>
                <CardDescription className="text-zinc-400 text-xs">
                  {activeTab === "SCHEDULED" 
                    ? "Schedules parsed via Vision AI or text filter containing active notifications." 
                    : "Non-outage announcements classified as irrelevant."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  {filteredOutages.length === 0 ? (
                    <div className="py-16 text-center flex flex-col items-center justify-center gap-2">
                      <Search className="h-10 w-10 text-zinc-700" />
                      <p className="text-sm font-semibold text-zinc-400">No matching outages</p>
                      <p className="text-xs text-zinc-500">Sync feed to parse new infographics.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-950/60 border-b border-zinc-800 text-zinc-400 font-semibold">
                          <th className="p-4 w-1/3">Notice / Infographic Source</th>
                          <th className="p-4 w-20">Status</th>
                          <th className="p-4 w-28">Target Date</th>
                          <th className="p-4 w-32">Time Windows</th>
                          <th className="p-4">Affected Areas / Substations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {filteredOutages.map((outage) => (
                          <tr key={outage.id} className="hover:bg-zinc-900/50 transition-colors group">
                            <td className="p-4 align-top">
                              <div className="font-bold text-zinc-200 mb-1 group-hover:text-zinc-100 transition-colors">
                                {outage.title}
                              </div>
                              <p className="text-[11px] text-zinc-400 line-clamp-2 pr-4">
                                {outage.rawText}
                              </p>
                              
                              <div className="flex gap-3 mt-2">
                                {outage.imageUrl && (
                                  <a 
                                    href={outage.imageUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-zinc-400 hover:text-zinc-200 font-semibold flex items-center gap-1 hover:underline"
                                  >
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    View Infographic Image
                                  </a>
                                )}
                                {outage.url && (
                                  <a 
                                    href={outage.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-zinc-400 hover:text-zinc-200 hover:underline flex items-center"
                                  >
                                    View Source Link →
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="p-4 align-top">
                              {outage.status === "SCHEDULED" ? (
                                <Badge className="bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 py-0.5 px-2 rounded font-semibold text-[10px]">
                                  Scheduled
                                </Badge>
                              ) : (
                                <Badge className="bg-zinc-800/40 hover:bg-zinc-800/60 text-zinc-400 border border-zinc-850 py-0.5 px-2 rounded font-normal text-[10px]">
                                  Filtered
                                </Badge>
                              )}
                            </td>
                            <td className="p-4 align-top text-zinc-300 font-medium whitespace-nowrap">
                              {formatDate(outage.outageDate)}
                            </td>
                            <td className="p-4 align-top text-zinc-300">
                              {outage.timeWindows && Array.isArray(outage.timeWindows) && outage.timeWindows.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {outage.timeWindows.map((win, idx) => (
                                    <span key={idx} className="flex items-center gap-1 whitespace-nowrap text-[11px]">
                                      <Clock className="h-3 w-3 text-zinc-400 shrink-0" />
                                      {win.start} - {win.end}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-zinc-500">Not Specified</span>
                              )}
                            </td>
                            <td className="p-4 align-top">
                              {/* Substations Tag Row */}
                              {outage.substations && outage.substations.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {outage.substations.map((sub, idx) => (
                                    <span 
                                      key={`sub-${idx}`} 
                                      className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-200 border border-zinc-700 font-semibold"
                                    >
                                      ⚡ {sub}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Municipalities Tag Row */}
                              <div className="flex flex-wrap gap-1">
                                {outage.areasAffected.length === 0 && (!outage.substations || outage.substations.length === 0) ? (
                                  <span className="text-zinc-500 italic">No specific zones parsed</span>
                                ) : (
                                  outage.areasAffected.map((area, idx) => (
                                    <span 
                                      key={`area-${idx}`} 
                                      className="px-2 py-0.5 rounded bg-zinc-950 text-[10px] text-zinc-400 border border-zinc-850 font-medium"
                                    >
                                      {area}
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 px-6 py-6 text-center text-xs text-zinc-500 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} Aklan Power Outage Alert. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-zinc-300">Status</a>
            <a href="#" className="hover:text-zinc-300">Privacy</a>
            <a href="#" className="hover:text-zinc-300">Contact Support</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
