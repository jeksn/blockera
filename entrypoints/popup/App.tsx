import { useState, useEffect } from "react";
import { Settings, Shield, ExternalLink, Clock, Globe, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getBlockedSites, saveBlockedSites, getTimeout, saveTimeout, type TimeoutOption } from "@/utils/storage";
import "@/assets/tailwind.css";

const timeoutOptions: { value: TimeoutOption; label: string }[] = [
  { value: 0, label: "Always block" },
  { value: 5, label: "5 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "60 min" },
];

function App() {
  const [sites, setSites] = useState<string[]>([]);
  const [newSite, setNewSite] = useState("");
  const [timeout, setTimeout] = useState<TimeoutOption>(0);
  const [showSettings, setShowSettings] = useState(false);

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

  const removeSite = (siteToRemove: string) => {
    const updated = sites.filter(site => site !== siteToRemove);
    setSites(updated);
    saveBlockedSites(updated);
  };

  const openOptions = () => {
    browser.runtime.openOptionsPage();
    window.close();
  };

  if (showSettings) {
    return (
      <div className="w-[380px] bg-background">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Blockera</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(false)}
            >
              Back
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
          {/* Timeout Setting */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Default Timeout
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {timeoutOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={timeout === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTimeoutChange(option.value)}
                    className="text-xs"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Add Site */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Block Site
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newSite}
                  onChange={(e) => setNewSite(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSite()}
                  placeholder="example.com"
                  className="text-sm"
                />
                <Button onClick={addSite} size="sm" disabled={!newSite.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Blocked Sites */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Blocked Sites</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {sites.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {sites.length > 0 ? (
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {sites.map((site) => (
                    <div
                      key={site}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm font-mono truncate flex-1">{site}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSite(site)}
                        className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No sites blocked
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[320px] p-4 bg-background">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Blockera</CardTitle>
          </div>
          <CardDescription>Stay focused, block distractions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setShowSettings(true)} variant="default" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <Button onClick={openOptions} variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Advanced
            </Button>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{sites.length} sites blocked</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {timeoutOptions.find(o => o.value === timeout)?.label}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
