import { useState, useEffect } from "react";
import { getBlockedSites, saveBlockedSites, getTimeout, saveTimeout, type TimeoutOption } from "@/utils/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Shield, Globe, LayoutGrid, Settings2, ExternalLink, Clock } from "lucide-react";
import "@/assets/tailwind.css";

const timeoutOptions: { value: TimeoutOption; label: string }[] = [
  { value: 0, label: "No timeout - Always block" },
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "60 minutes" },
];

function App() {
  const [sites, setSites] = useState<string[]>([]);
  const [newSite, setNewSite] = useState("");
  const [timeout, setTimeout] = useState<TimeoutOption>(0);

  useEffect(() => {
    getBlockedSites().then(setSites);
    getTimeout().then(setTimeout);
  }, []);

  const handleTimeoutChange = (value: TimeoutOption) => {
    setTimeout(value);
    saveTimeout(value);
  };

  const addSite = () => {
    const site = newSite.trim().toLowerCase();
    if (!site) return;

    let normalized = site.replace(/^https?:\/\//, "");
    normalized = normalized.replace(/^www\./, "");
    normalized = normalized.replace(/\/.*/, "");

    if (!sites.includes(normalized)) {
      const updated = [...sites, normalized];
      setSites(updated);
      saveBlockedSites(updated);
    }
    setNewSite("");
  };

  const removeSite = (index: number) => {
    const updated = sites.filter((_, i) => i !== index);
    setSites(updated);
    saveBlockedSites(updated);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-none">Blockera</h1>
              <p className="text-xs text-muted-foreground mt-1">Site Blocker Settings</p>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono">
            {sites.length} blocked
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          
          {/* Sidebar */}
          <aside className="space-y-6 lg:block">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  About
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>
                  Blockera helps you stay focused by blocking distracting websites.
                </p>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <LayoutGrid className="h-3 w-3" />
                    <span>Blur overlay on blocked sites</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <ExternalLink className="h-3 w-3" />
                    <span>Click "Let me in" to dismiss</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Main Settings Area */}
          <div className="space-y-6">
            
            {/* Timeout Settings Card */}
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Timeout Settings
                </CardTitle>
                <CardDescription>
                  Choose how long to allow access when you dismiss the block screen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {timeoutOptions.map((option) => (
                    <div
                      key={option.value}
                      className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                        timeout === option.value
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => handleTimeoutChange(option.value)}
                    >
                      <Label className="cursor-pointer flex-1">{option.label}</Label>
                      <div
                        className={`h-4 w-4 rounded-full border ${
                          timeout === option.value
                            ? "border-primary bg-primary"
                            : "border-muted-foreground"
                        }`}
                      >
                        {timeout === option.value && (
                          <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Add Site Card */}
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-xl">Add Site</CardTitle>
                <CardDescription>
                  Enter a domain to block. Examples: twitter.com, reddit.com, youtube.com
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      value={newSite}
                      onChange={(e) => setNewSite(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSite()}
                      placeholder="example.com"
                      className="pl-9"
                    />
                  </div>
                  <Button 
                    onClick={addSite} 
                    disabled={!newSite.trim()}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Site
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Blocked Sites List */}
            <Card>
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Blocked Sites</CardTitle>
                  {sites.length > 0 && (
                    <Badge variant="outline" className="font-mono">
                      {sites.length} total
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  Manage your list of blocked websites
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sites.length > 0 ? (
                  <div className="space-y-2">
                    {sites.map((site, index) => (
                      <div
                        key={site}
                        className="group flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <code className="text-sm font-medium">{site}</code>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSite(index)}
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Remove {site}</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Globe className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="mt-4 text-sm font-medium">No sites blocked</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add your first site above to start blocking distractions
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
