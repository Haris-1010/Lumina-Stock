"use client";

import { useEffect, useState } from "react";
import { Mail, Plus, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { rfListEmailCampaigns, rfCreateEmailCampaign, rfGenerateEmailContent } from "@/lib/reachflow";

interface EmailCampaign { id: string; name: string; subject: string; status: string }

const STATUS_PILL: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function EmailPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    rfListEmailCampaigns().then((data) => {
      setCampaigns(data ?? []);
      setLoading(false);
    });
  }, []);

  const generateContent = async () => {
    if (!brief.trim()) return;
    setGenerating(true);
    const result = await rfGenerateEmailContent(brief.trim());
    if (result) {
      setSubject(result.subject);
      setBody(result.body);
    }
    setGenerating(false);
  };

  const createCampaign = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setError("Name, subject, and body are required");
      return;
    }
    setSaving(true);
    setError("");
    const result = await rfCreateEmailCampaign({ name: name.trim(), subject: subject.trim(), body: body.trim(), listId: "default" });
    if (result) {
      setCampaigns((prev) => [...prev, { ...result, subject }]);
      setShowForm(false);
      setName(""); setSubject(""); setBody(""); setBrief("");
    } else {
      setError("Failed to create email campaign");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Mail className="h-6 w-6 text-amber-500" />
            Email Campaigns
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Draft, generate, and send email campaigns</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Email
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">New Email Campaign</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Campaign Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Sale Newsletter" />
            </div>

            {/* AI generation */}
            <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3 space-y-3 bg-zinc-50 dark:bg-zinc-900/50">
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Generate with AI</p>
              <div className="flex gap-2">
                <Input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Brief: e.g. promote clearance on electronics, 20% off" className="flex-1" />
                <Button onClick={generateContent} disabled={generating} size="sm" variant="outline">
                  {generating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Generate
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Subject Line</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. 20% off everything this weekend only" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Body</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Email body HTML or plain text…" />
            </div>

            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={createCampaign} disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Save as Draft
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign list */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />)}
        </div>
      )}

      {!loading && campaigns.length === 0 && !showForm && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <Mail className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">No email campaigns yet</p>
            <Button size="sm" onClick={() => setShowForm(true)}>Create your first email</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {campaigns.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{c.name}</p>
                <p className="text-xs text-zinc-400 truncate mt-0.5">{c.subject}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${STATUS_PILL[c.status] ?? STATUS_PILL.draft}`}>
                {c.status}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
