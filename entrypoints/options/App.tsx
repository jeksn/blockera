import { useEffect, useState } from "react";
import {
  getGroups,
  saveGroups,
  createGroup,
  normalizeSiteInput,
  ALLOW_PRESETS,
  BUDGET_PRESETS,
  type BlockGroup,
} from "@/utils/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, X, Shield, Globe, Layers, Clock, Timer } from "lucide-react";
import "@/assets/tailwind.css";

const allowLabels: Record<number, string> = {
  0: "Just this once",
  5: "5 min",
  15: "15 min",
  30: "30 min",
  60: "60 min",
};

const budgetLabels: Record<number, string> = {
  0: "Unlimited",
  5: "5 min/day",
  10: "10 min/day",
  15: "15 min/day",
  30: "30 min/day",
  60: "60 min/day",
};

function App() {
  const [groups, setGroups] = useState<BlockGroup[]>([]);
  const [newSites, setNewSites] = useState<Record<string, string>>({});

  useEffect(() => {
    getGroups().then(setGroups);
  }, []);

  const persist = (updated: BlockGroup[]) => {
    setGroups(updated);
    saveGroups(updated);
  };

  const updateGroup = (id: string, patch: Partial<BlockGroup>) => {
    persist(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const addGroup = () => {
    const group = createGroup(`Group ${groups.length + 1}`);
    persist([...groups, group]);
  };

  const deleteGroup = (id: string) => {
    persist(groups.filter((g) => g.id !== id));
  };

  const addSite = (group: BlockGroup) => {
    const normalized = normalizeSiteInput(newSites[group.id] || "");
    if (!normalized || group.sites.includes(normalized)) {
      setNewSites((s) => ({ ...s, [group.id]: "" }));
      return;
    }
    updateGroup(group.id, { sites: [...group.sites, normalized] });
    setNewSites((s) => ({ ...s, [group.id]: "" }));
  };

  const removeSite = (group: BlockGroup, site: string) => {
    updateGroup(group.id, { sites: group.sites.filter((s) => s !== site) });
  };

  const totalSites = groups.reduce((sum, g) => sum + g.sites.length, 0);

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
              <p className="text-xs text-muted-foreground mt-1">Block Groups</p>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono">
            {totalSites} blocked
          </Badge>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <p className="text-sm text-muted-foreground">
          Sites are organised into groups, each with its own rules. A site is
          blocked when it matches any site in a group, and the first matching
          group's rules apply. Blocking covers the domain and all its subdomains.
        </p>

        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Input
                    value={group.name}
                    onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                    placeholder="Group name"
                    className="text-lg font-semibold border-transparent bg-transparent px-0 focus-visible:ring-0 h-8"
                  />
                  <CardDescription className="mt-1">
                    {group.sites.length} {group.sites.length === 1 ? "site" : "sites"}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteGroup(group.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete {group.name}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Sites */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  Sites
                </div>
                {group.sites.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {group.sites.map((site) => (
                      <span
                        key={site}
                        className="inline-flex items-center gap-1 rounded-md border bg-muted/50 pl-2.5 pr-1 py-1 text-sm font-mono"
                      >
                        {site}
                        <button
                          onClick={() => removeSite(group, site)}
                          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                          <span className="sr-only">Remove {site}</span>
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No sites yet — this group blocks nothing.
                  </p>
                )}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      value={newSites[group.id] || ""}
                      onChange={(e) =>
                        setNewSites((s) => ({ ...s, [group.id]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && addSite(group)}
                      placeholder="example.com"
                      className="pl-9"
                    />
                  </div>
                  <Button
                    onClick={() => addSite(group)}
                    disabled={!(newSites[group.id] || "").trim()}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Rules */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Access per dismiss
                  </div>
                  <p className="text-xs text-muted-foreground">
                    How long a "Let me in" click unblocks the site.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ALLOW_PRESETS.map((min) => (
                      <Button
                        key={min}
                        size="sm"
                        variant={group.allowMinutes === min ? "default" : "outline"}
                        onClick={() => updateGroup(group.id, { allowMinutes: min })}
                        className="text-xs"
                      >
                        {allowLabels[min]}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    Daily limit
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total allowed time per day. Once spent, the site is locked
                    until midnight.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {BUDGET_PRESETS.map((min) => (
                      <Button
                        key={min}
                        size="sm"
                        variant={group.dailyBudgetMinutes === min ? "default" : "outline"}
                        onClick={() =>
                          updateGroup(group.id, { dailyBudgetMinutes: min })
                        }
                        className="text-xs"
                      >
                        {budgetLabels[min]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button onClick={addGroup} variant="outline" className="w-full gap-2 border-dashed">
          <Layers className="h-4 w-4" />
          Add block group
        </Button>
      </main>
    </div>
  );
}

export default App;
