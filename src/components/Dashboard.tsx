"use client";

import React, { useState, useMemo } from "react";
import { 
  AlertTriangle, 
  CheckCircle, 
  MapPin, 
  Mail, 
  Phone, 
  Search, 
  Bell, 
  Clock, 
  Filter, 
  Database,
  RefreshCw,
  Info,
  Image as ImageIcon
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

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
  subscriberCount: number;
}

export default function Dashboard({ initialOutages, subscriberCount }: DashboardProps) {
  const [outages, setOutages] = useState<Outage[]>(initialOutages);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"SCHEDULED" | "FILTERED_OUT">("SCHEDULED");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");

  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [area, setArea] = useState("");
  const [loading, setLoading] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const stats = useMemo(() => {
    const scheduled = outages.filter((o) => o.status === "SCHEDULED").length;
    const filtered = outages.filter((o) => o.status === "FILTERED_OUT").length;
    return {
      total: outages.length,
      scheduled,
      filtered,
      subscribers: subscriberCount
    };
  }, [outages, subscriberCount]);

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

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormMessage(null);

    if (!area.trim()) {
      setFormMessage({ type: "error", text: "Please enter your Barangay or Municipality." });
      setLoading(false);
      return;
    }

    if (!email.trim() && !phoneNumber.trim()) {
      setFormMessage({ type: "error", text: "Please enter either an email address or phone number." });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          phoneNumber: phoneNumber.trim(),
          areaOfInterest: area.trim()
        })
      });

      const data = await response.json();

      if (response.ok) {
        setFormMessage({ type: "success", text: data.message || "Subscribed successfully!" });
        setEmail("");
        setPhoneNumber("");
        setArea("");
      } else {
        setFormMessage({ type: "error", text: data.error || "Subscription failed. Please try again." });
      }
    } catch (err) {
      console.error(err);
      setFormMessage({ type: "error", text: "Connection error. Please try again later." });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFeed = async () => {
    setIsRefreshing(true);
    setRefreshMessage("Running ingestion and Vision parsing...");
    try {
      const response = await fetch("/api/cron/fetch-outages", { method: "POST" });
      const data = await response.json();
      if (response.ok && data.success) {
        setRefreshMessage(`Successfully ingested ${data.processedCount} new notices!`);
        window.location.reload();
      } else {
        setRefreshMessage("No new updates found or fetch failed.");
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-900">
      
      {/* Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-cyan-500 to-amber-500 p-2 rounded-xl text-slate-950 shadow-lg shadow-cyan-500/20">
              <AlertTriangle className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-400 bg-clip-text text-transparent">
                Aklan Outage Notifier
              </h1>
              <p className="text-xs text-slate-400">Automated 24h Interruption Advisory System</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {refreshMessage && (
              <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300 flex items-center gap-1.5">
                <Info className="h-3 w-3 text-cyan-400" />
                {refreshMessage}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncFeed}
              disabled={isRefreshing}
              className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
              Sync Feed
            </Button>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
              <span className="text-xs text-slate-400 font-medium">Vision Feed Live</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-8">
        
        {/* Stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Outages</p>
                <h3 className="text-3xl font-extrabold text-cyan-400 mt-1">{stats.scheduled}</h3>
              </div>
              <div className="bg-cyan-500/10 p-3 rounded-lg text-cyan-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Unrelated Filtered</p>
                <h3 className="text-3xl font-extrabold text-slate-400 mt-1">{stats.filtered}</h3>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg text-slate-400">
                <Filter className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Alert Subscribers</p>
                <h3 className="text-3xl font-extrabold text-amber-400 mt-1">{stats.subscribers}</h3>
              </div>
              <div className="bg-amber-500/10 p-3 rounded-lg text-amber-400">
                <Bell className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Ingested</p>
                <h3 className="text-3xl font-extrabold text-teal-400 mt-1">{stats.total}</h3>
              </div>
              <div className="bg-teal-500/10 p-3 rounded-lg text-teal-400">
                <Database className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Subscribe Panel */}
          <section className="lg:col-span-1 flex flex-col gap-6">
            <Card className="bg-slate-900/50 border-slate-800/80 backdrop-blur-md shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-amber-500" />
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Bell className="h-5 w-5 text-amber-400" />
                  Subscribe to Alerts
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  Register your area of interest (substation or town) to get automated 24h advance reminders.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubscribe} className="flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="area" className="text-xs text-slate-300 font-semibold">
                      Your Barangay, Town, or Substation Zone
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        id="area"
                        type="text"
                        placeholder="e.g. Kalibo, Nabas Substation, Numancia"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-100 pl-10 focus-visible:ring-cyan-500 focus-visible:ring-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs text-slate-300 font-semibold">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-100 pl-10 focus-visible:ring-cyan-500 focus-visible:ring-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-center text-xs text-slate-500 font-semibold my-1">
                    — OR —
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs text-slate-300 font-semibold">
                      Mobile Number
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="e.g. +639171234567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-100 pl-10 focus-visible:ring-cyan-500 focus-visible:ring-1 text-xs"
                      />
                    </div>
                  </div>

                  {formMessage && (
                    <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                      formMessage.type === "success" 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                        : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    }`}>
                      {formMessage.type === "success" ? (
                        <CheckCircle className="h-4 w-4 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                      )}
                      <span>{formMessage.text}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 hover:opacity-90 font-bold transition-opacity text-xs py-2.5"
                  >
                    {loading ? "Registering..." : "Subscribe Now"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/30 border-slate-800/80 text-xs text-slate-400 p-5 flex flex-col gap-3">
              <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-cyan-400" />
                Vision-Powered Advisory System
              </h4>
              <ol className="list-decimal pl-4 space-y-2">
                <li>System automatically parses RSS updates. If image infographics are found, they are processed using **Gemini Vision AI**.</li>
                <li>Vision AI OCR extracts dates, substations, split-schedules, and municipalities.</li>
                <li>Subscribers receive warnings 24 hours prior if their location or substation zone is affected.</li>
              </ol>
            </Card>
          </section>

          {/* Outages Log Section */}
          <section className="lg:col-span-2 flex flex-col gap-6">
            
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              {/* Tab toggles */}
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
                <button
                  onClick={() => setActiveTab("SCHEDULED")}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    activeTab === "SCHEDULED"
                      ? "bg-gradient-to-r from-cyan-500/25 to-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Scheduled Reminders ({stats.scheduled})
                </button>
                <button
                  onClick={() => setActiveTab("FILTERED_OUT")}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    activeTab === "FILTERED_OUT"
                      ? "bg-slate-800 text-slate-300 border border-slate-700"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filtered Out ({stats.filtered})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  type="text"
                  placeholder="Search towns, substations, text..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-slate-100 pl-10 focus-visible:ring-cyan-500 focus-visible:ring-1 text-xs"
                />
              </div>
            </div>

            {/* Outage Table */}
            <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur-md shadow-xl flex-1 overflow-hidden">
              <CardHeader className="border-b border-slate-800/60 pb-4">
                <CardTitle className="text-base font-bold text-slate-200">
                  {activeTab === "SCHEDULED" ? "Ingested Outage Alerts" : "Filtered Non-Outage Logs"}
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  {activeTab === "SCHEDULED" 
                    ? "Schedules parsed via Vision AI or text filter containing active notifications." 
                    : "Non-outage announcements classified as irrelevant."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  {filteredOutages.length === 0 ? (
                    <div className="py-16 text-center flex flex-col items-center justify-center gap-2">
                      <Search className="h-10 w-10 text-slate-600" />
                      <p className="text-sm font-semibold text-slate-400">No matching outages</p>
                      <p className="text-xs text-slate-500">Sync feed to parse new infographics.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900/60 border-b border-slate-850 text-slate-400 font-semibold">
                          <th className="p-4 w-1/3">Notice / Infographic Source</th>
                          <th className="p-4 w-20">Status</th>
                          <th className="p-4 w-28">Target Date</th>
                          <th className="p-4 w-32">Time Windows</th>
                          <th className="p-4">Affected Areas / Substations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {filteredOutages.map((outage) => (
                          <tr key={outage.id} className="hover:bg-slate-900/30 transition-colors group">
                            <td className="p-4 align-top">
                              <div className="font-bold text-slate-200 mb-1 group-hover:text-cyan-400 transition-colors">
                                {outage.title}
                              </div>
                              <p className="text-[11px] text-slate-500 line-clamp-2 pr-4">
                                {outage.rawText}
                              </p>
                              
                              <div className="flex gap-3 mt-2">
                                {outage.imageUrl && (
                                  <a 
                                    href={outage.imageUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 hover:underline"
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
                                    className="text-[10px] text-cyan-500/80 hover:text-cyan-400 hover:underline flex items-center"
                                  >
                                    View Source Link →
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="p-4 align-top">
                              {outage.status === "SCHEDULED" ? (
                                <Badge className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 py-0.5 rounded font-extrabold text-[10px]">
                                  Scheduled
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 py-0.5 rounded font-semibold text-[10px]">
                                  Filtered
                                </Badge>
                              )}
                            </td>
                            <td className="p-4 align-top text-slate-300 font-semibold whitespace-nowrap">
                              {formatDate(outage.outageDate)}
                            </td>
                            <td className="p-4 align-top text-slate-300">
                              {outage.timeWindows && Array.isArray(outage.timeWindows) && outage.timeWindows.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {outage.timeWindows.map((win, idx) => (
                                    <span key={idx} className="flex items-center gap-1 whitespace-nowrap text-[11px]">
                                      <Clock className="h-3 w-3 text-cyan-400 shrink-0" />
                                      {win.start} - {win.end}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500">Not Specified</span>
                              )}
                            </td>
                            <td className="p-4 align-top">
                              {/* Substations Tag Row */}
                              {outage.substations && outage.substations.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {outage.substations.map((sub, idx) => (
                                    <span 
                                      key={`sub-${idx}`} 
                                      className="px-2 py-0.5 rounded bg-amber-500/10 text-[10px] text-amber-300 border border-amber-500/20 font-semibold"
                                    >
                                      ⚡ {sub}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Municipalities Tag Row */}
                              <div className="flex flex-wrap gap-1">
                                {outage.areasAffected.length === 0 && (!outage.substations || outage.substations.length === 0) ? (
                                  <span className="text-slate-500 italic">No specific zones parsed</span>
                                ) : (
                                  outage.areasAffected.map((area, idx) => (
                                    <span 
                                      key={`area-${idx}`} 
                                      className="px-2 py-0.5 rounded bg-slate-800/80 text-[10px] text-slate-300 border border-slate-750 font-medium"
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
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-6 text-center text-xs text-slate-600 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} Aklan Power Outage Alert. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-400 font-semibold">Status</a>
            <a href="#" className="hover:text-slate-400 font-semibold">Privacy</a>
            <a href="#" className="hover:text-slate-400 font-semibold">Contact Support</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
