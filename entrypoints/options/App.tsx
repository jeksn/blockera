import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  getGroups,
  saveGroups,
  createGroup,
  normalizeSiteInput,
  ALLOW_PRESETS,
  BUDGET_PRESETS,
  DELAY_PRESETS,
  exportGroupsJSON,
  importGroupsFromJSON,
  getPasswordSetting,
  savePasswordSetting,
  clearPasswordSetting,
  hashPassword,
  randomSalt,
  verifyPassword,
  getStats,
  type BlockGroup,
  type DayStats,
} from "@/utils/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Trash2,
  Plus,
  X,
  Shield,
  Globe,
  Clock,
  Timer,
  Ban,
  Lock,
} from "lucide-react";
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
  // null = still checking; true = password set and not yet unlocked
  const [locked, setLocked] = useState<boolean | null>(null);
  const [unlockError, setUnlockError] = useState("");
  const [unlockInput, setUnlockInput] = useState("");

  useEffect(() => {
    getPasswordSetting().then((setting) => setLocked(setting !== null));
  }, []);

  const handleUnlock = async () => {
    const ok = await verifyPassword(unlockInput);
    if (ok) {
      setLocked(false);
      setUnlockError("");
    } else {
      setUnlockError("Wrong password");
    }
  };

  if (locked === null) {
    return <div className="min-h-screen bg-background" />;
  }

  if (locked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Settings locked</CardTitle>
            </div>
            <CardDescription>
              Enter your password to manage your block groups.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="password"
              value={unlockInput}
              onChange={(e) => setUnlockInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder="Password"
              autoFocus
            />
            {unlockError && (
              <p className="text-sm text-destructive">{unlockError}</p>
            )}
            <Button onClick={handleUnlock} className="w-full">
              Unlock
            </Button>
            <p className="text-xs text-muted-foreground">
              There is no in-app reset. If you forget the password, remove
              the extension from chrome://extensions and reinstall it — all
              settings will be lost.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <Settings />;
}

function Settings() {
  const [groups, setGroups] = useState<BlockGroup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'stats' | 'group' | 'security'>('home');
  const [hasPassword, setHasPassword] = useState(false);
  const [newSites, setNewSites] = useState<Record<string, string>>({});

  useEffect(() => {
    getGroups().then((loaded) => {
      setGroups(loaded);
      if (loaded.length > 0) setSelectedId(loaded[0].id);
    });
    getPasswordSetting().then((setting) => setHasPassword(setting !== null));
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
    setSelectedId(group.id);
    setView('group');
  };

  const deleteGroup = (id: string) => {
    const updated = groups.filter((g) => g.id !== id);
    persist(updated);
    if (selectedId === id) {
      setSelectedId(updated[0]?.id ?? null);
    }
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

  const selectedGroup = groups.find((g) => g.id === selectedId) || null;
  const totalSites = groups.reduce((sum, g) => sum + g.sites.length, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
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

      <main className="container mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          {/* Sidebar */}
          <aside className="space-y-1">
            <button
              className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                view === 'home' ? 'bg-secondary' : 'hover:bg-muted/60'
              }`}
              onClick={() => setView('home')}
            >
              <Shield className="h-4 w-4 text-muted-foreground" />
              Home
            </button>

            <button
              className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                view === 'stats' ? 'bg-secondary' : 'hover:bg-muted/60'
              }`}
              onClick={() => setView('stats')}
            >
              <Timer className="h-4 w-4 text-muted-foreground" />
              Stats
            </button>

            <button
              className={`w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                view === 'security' ? 'bg-secondary' : 'hover:bg-muted/60'
              }`}
              onClick={() => setView('security')}
            >
              <span className="flex items-center gap-2">
                {hasPassword ? (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Shield className="h-4 w-4 text-muted-foreground" />
                )}
                Security
              </span>
              {hasPassword && <Badge variant="outline" className="text-[10px] px-1.5">on</Badge>}
            </button>

            <Separator className="my-2" />

            {groups.map((group) => (
              <button
                key={group.id}
                className={`w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  view === 'group' && selectedId === group.id
                    ? 'bg-secondary'
                    : 'hover:bg-muted/60'
                }`}
                onClick={() => {
                  setSelectedId(group.id);
                  setView('group');
                }}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {!group.allowOverride ? (
                    <Ban className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate">{group.name}</span>
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                  {group.sites.length}
                </Badge>
              </button>
            ))}

            <button
              onClick={addGroup}
              className="w-full mt-3 flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current">
                <Plus className="h-3 w-3" />
              </span>
              New group
            </button>
          </aside>

          {/* Main panel */}
          <div>
            {view === 'security' ? (
              <SecurityPanel
                hasPassword={hasPassword}
                onPasswordChange={setHasPassword}
                onGroupsImported={(imported) => {
                  setGroups(imported);
                  saveGroups(imported);
                  setSelectedId(imported[0]?.id ?? null);
                }}
                currentGroupCount={groups.length}
              />
            ) : view === 'stats' ? (
              <StatsPanel groups={groups} />
            ) : view === 'home' ? (
              <Landing onAddGroup={addGroup} groupCount={groups.length} />
            ) : selectedGroup ? (
              <GroupEditor
                group={selectedGroup}
                newSiteValue={newSites[selectedGroup.id] || ""}
                onNewSiteChange={(value) =>
                  setNewSites((s) => ({ ...s, [selectedGroup.id]: value }))
                }
                onAddSite={() => addSite(selectedGroup)}
                onRemoveSite={(site) => removeSite(selectedGroup, site)}
                onUpdate={(patch) => updateGroup(selectedGroup.id, patch)}
                onDelete={() => deleteGroup(selectedGroup.id)}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No groups yet. Add one to start blocking sites.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const CHART_COLORS = [
  "#7dd3fc",
  "#c4b5fd",
  "#86efac",
  "#fca5a5",
  "#fcd34d",
  "#a5b4fc",
  "#5eead4",
  "#f9a8d4",
];

const colorForGroup = (index: number) =>
  CHART_COLORS[index % CHART_COLORS.length];

function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes === 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

const dayLabel = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
  });
};

function StatsPanel({ groups }: { groups: BlockGroup[] }) {
  const [days, setDays] = useState<DayStats[] | null>(null);

  const groupKey = groups.map((g) => g.id).join(",");
  useEffect(() => {
    getStats(groups).then(setDays);
    // Refetch when the set of groups changes; content refreshes on view
    // switch by remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey]);

  if (!days) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Loading stats…
        </CardContent>
      </Card>
    );
  }

  const today = days[days.length - 1];
  const todaySeconds = Object.values(today.seconds).reduce((a, b) => a + b, 0);
  const todayAttempts = Object.values(today.attempts).reduce(
    (a, b) => a + b,
    0
  );
  const maxSeconds = Math.max(1, ...days.map((d) => Object.values(d.seconds).reduce((a, b) => a + b, 0)));
  const hasAnyData = days.some(
    (d) =>
      Object.values(d.seconds).some((s) => s > 0) ||
      Object.values(d.attempts).some((a) => a > 0)
  );

  if (!hasAnyData) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nothing to show yet. Stats appear as you browse blocked sites.
        </CardContent>
      </Card>
    );
  }

  const budgeted = groups.filter((g) => g.dailyBudgetMinutes > 0);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Today */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Today</CardTitle>
          <CardDescription>
            Actual time spent on blocked sites, counted while the tab was
            visible. Closing the tab or switching away stops the meter.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-3xl font-semibold">{formatMinutes(todaySeconds)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              on blocked sites
            </p>
          </div>
          <div>
            <p className="text-3xl font-semibold">{todayAttempts}</p>
            <p className="text-xs text-muted-foreground mt-1">
              block screens shown
            </p>
          </div>
        </CardContent>

        {budgeted.length > 0 && (
          <CardContent className="space-y-3 pt-0">
            <Separator />
            {budgeted.map((group) => {
              const used = Math.round((today.seconds[group.id] || 0) / 60);
              const limit = group.dailyBudgetMinutes;
              const pct = Math.min(100, (used / limit) * 100);
              return (
                <div key={group.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{group.name}</span>
                    <span className="text-muted-foreground">
                      {used} of {limit} min
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        pct >= 100 ? "bg-destructive" : "bg-primary"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* Last 7 days */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Last 7 days</CardTitle>
          <CardDescription>Minutes per day, stacked by group.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-1.5 h-36">
            {days.map((day) => {
              const total = Object.values(day.seconds).reduce(
                (a, b) => a + b,
                0
              );
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center h-full"
                >
                  <div className="w-full flex-1 flex flex-col justify-end">
                    {total > 0 && (
                      <div
                        className="w-full flex flex-col-reverse overflow-hidden rounded-sm"
                        style={{ height: `${(total / maxSeconds) * 100}%` }}
                      >
                        {groups.map((group, i) => {
                          const sec = day.seconds[group.id] || 0;
                          if (!sec) return null;
                          return (
                            <div
                              key={group.id}
                              style={{
                                height: `${(sec / total) * 100}%`,
                                background: colorForGroup(i),
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {dayLabel(day.date)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {groups.map((group, i) => {
              const weekSeconds = days.reduce(
                (a, d) => a + (d.seconds[group.id] || 0),
                0
              );
              const weekAttempts = days.reduce(
                (a, d) => a + (d.attempts[group.id] || 0),
                0
              );
              return (
                <div
                  key={group.id}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: colorForGroup(i) }}
                  />
                  <span className="text-foreground">{group.name}</span>
                  {formatMinutes(weekSeconds)}
                  {weekAttempts > 0 && ` · ${weekAttempts} blocks`}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Landing({
  onAddGroup,
  groupCount,
}: {
  onAddGroup: () => void;
  groupCount: number;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Blockera</CardTitle>
          </div>
          <CardDescription className="text-base leading-relaxed">
            A distraction blocker you set up while you're clear-headed, so
            you don't have to win an argument with yourself at 11pm.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sites you block are covered by a full-screen blur with a "Stay
            Focused" screen. Depending on your rules, you can dismiss it for a
            fixed time — with a countdown timer that brings the screen back
            when it expires — give yourself a daily time budget, or lock the
            site behind a screen with no way out at all.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            How to use it
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>
            <span className="font-medium">1. Create a group</span> for a
            category of distraction — Social, Video, News, whatever pulls at
            you.
          </p>
          <p>
            <span className="font-medium">2. Add sites.</span> A site matches
            its domain and all subdomains.
          </p>
          <p>
            <span className="font-medium">3. Pick the rules.</span> Allow
            temporary access with a countdown, cap it with a daily limit that
            locks the site until midnight once it's spent, or choose always
            block for sites you never want an excuse to open.
          </p>
          {groupCount === 0 && (
            <Button onClick={onAddGroup} className="gap-2">
              <Plus className="h-4 w-4" />
              Add your first group
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Why it works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Blockera can't physically stop you from doing anything. What it
            does is put a pause and a conscious decision between impulse and
            action — you have to actively choose to dismiss the block screen,
            every single time. That pause is usually enough. The point is
            friction, not force.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Personal responsibility — read this
          </CardTitle>
          <CardDescription>
            Blockera is a self-commitment tool. It's a promise you make to
            yourself, not a wall.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>
            It is deliberately bypassable by anyone determined: the extension
            can be disabled or removed from chrome://extensions in seconds,
            and it only covers this browser. Other browsers, other devices,
            and other user accounts are not covered. It also doesn't run in
            incognito windows unless you explicitly allow it in the
            extension's details.
          </p>
          <p>
            The settings password is a speed bump against a moment of
            weakness, not real security. Anyone with access to this device can
            remove it by reinstalling the extension.
          </p>
          <p>
            Blockera is not parental control software, not security software,
            and not a substitute for professional help. If your use of certain
            sites feels compulsive, or is harming your work, sleep, or
            relationships, please consider talking to someone qualified.
          </p>
          <p className="text-muted-foreground">
            Your data stays with you: block lists sync through your browser's
            own sync feature; allowances, daily usage, and the password never
            leave this device. Blockera has no servers and collects nothing.
          </p>
          <p className="text-muted-foreground">
            Provided as-is, with no warranty. How you use it — and whether it
            works — is up to you.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function GroupEditor({
  group,
  newSiteValue,
  onNewSiteChange,
  onAddSite,
  onRemoveSite,
  onUpdate,
  onDelete,
}: {
  group: BlockGroup;
  newSiteValue: string;
  onNewSiteChange: (value: string) => void;
  onAddSite: () => void;
  onRemoveSite: (site: string) => void;
  onUpdate: (patch: Partial<BlockGroup>) => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Input
              value={group.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="Group name"
              className="text-lg font-semibold h-10 max-w-xs"
            />
            <CardDescription className="mt-1">
              {group.sites.length} {group.sites.length === 1 ? "site" : "sites"}
              {!group.allowOverride && " · always blocked"}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
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
                    onClick={() => onRemoveSite(site)}
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
                value={newSiteValue}
                onChange={(e) => onNewSiteChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddSite()}
                placeholder="example.com"
                className="pl-9"
              />
            </div>
            <Button onClick={onAddSite} disabled={!newSiteValue.trim()} className="gap-2">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>

        <Separator />

        {/* Active hours */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Active hours
          </div>
          <p className="text-xs text-muted-foreground">
            When this group's blocking applies. Windows may cross midnight
            (e.g. 22:00 to 07:00).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={!group.activeFrom || !group.activeTo ? "default" : "outline"}
              onClick={() => onUpdate({ activeFrom: null, activeTo: null })}
              className="text-xs"
            >
              Always
            </Button>
            <Button
              size="sm"
              variant={group.activeFrom && group.activeTo ? "default" : "outline"}
              onClick={() =>
                onUpdate({
                  activeFrom: group.activeFrom ?? "22:00",
                  activeTo: group.activeTo ?? "07:00",
                })
              }
              className="text-xs"
            >
              Set hours
            </Button>
          </div>
          {group.activeFrom && group.activeTo && (
            <div className="flex items-center gap-2 pt-1">
              <Input
                type="time"
                value={group.activeFrom}
                onChange={(e) => onUpdate({ activeFrom: e.target.value || null })}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="time"
                value={group.activeTo}
                onChange={(e) => onUpdate({ activeTo: e.target.value || null })}
                className="w-32"
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Override */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Ban className="h-4 w-4 text-muted-foreground" />
            Override
          </div>
          <p className="text-xs text-muted-foreground">
            Always-block groups show the block screen with no way to dismiss
            it — use these for sites you never want to talk yourself into.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={group.allowOverride ? "default" : "outline"}
              onClick={() => onUpdate({ allowOverride: true })}
              className="text-xs"
            >
              Allow temporary access
            </Button>
            <Button
              size="sm"
              variant={!group.allowOverride ? "default" : "outline"}
              onClick={() => onUpdate({ allowOverride: false })}
              className="text-xs"
            >
              Always block
            </Button>
          </div>
        </div>

        {group.allowOverride ? (
          <>
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
                      onClick={() => onUpdate({ allowMinutes: min })}
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
                      onClick={() => onUpdate({ dailyBudgetMinutes: min })}
                      className="text-xs"
                    >
                      {budgetLabels[min]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  Delay
                </div>
                <p className="text-xs text-muted-foreground">
                  "Let me in" stays disabled for the first seconds after the
                  block screen appears — a breather before you can unblock.
                </p>
                <div className="flex flex-wrap gap-2">
                  {DELAY_PRESETS.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={group.delaySeconds === s ? "default" : "outline"}
                      onClick={() => onUpdate({ delaySeconds: s })}
                      className="text-xs"
                    >
                      {s === 0 ? "None" : `${s}s`}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sites in this group are always blocked. Access and daily limit
            rules don't apply.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SecurityPanel({
  hasPassword,
  onPasswordChange,
  onGroupsImported,
  currentGroupCount,
}: {
  hasPassword: boolean;
  onPasswordChange: (has: boolean) => void;
  onGroupsImported: (groups: BlockGroup[]) => void;
  currentGroupCount: number;
}) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const saveNewPassword = async () => {
    if (newPw.length < 4) {
      setMessage({ error: true, text: "Password must be at least 4 characters." });
      return;
    }
    if (newPw !== confirmPw) {
      setMessage({ error: true, text: "Passwords don't match." });
      return;
    }
    const salt = randomSalt();
    const hash = await hashPassword(newPw, salt);
    await savePasswordSetting({ salt, hash });
    onPasswordChange(true);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setMessage({ error: false, text: "Password set. Settings will ask for it when opened." });
  };

  const removePassword = async () => {
    const ok = await verifyPassword(currentPw);
    if (!ok) {
      setMessage({ error: true, text: "Wrong password." });
      return;
    }
    await clearPasswordSetting();
    onPasswordChange(false);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setMessage({ error: false, text: "Password removed." });
  };

  return (
    <>
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Settings Password
        </CardTitle>
        <CardDescription>
          {hasPassword
            ? "A password is required to open these settings. There is no in-app reset: if you forget it, remove and reinstall the extension (all settings are lost)."
            : "Optional. When set, opening these settings requires the password. There is no in-app reset: if you forget it, remove and reinstall the extension (all settings are lost)."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPassword ? (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">Change password</p>
              <Input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Current password"
              />
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="New password"
              />
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Confirm new password"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={async () => {
                    const ok = await verifyPassword(currentPw);
                    if (!ok) {
                      setMessage({ error: true, text: "Wrong password." });
                      return;
                    }
                    await saveNewPassword();
                  }}
                  disabled={!currentPw || !newPw || !confirmPw}
                >
                  Change password
                </Button>
                <Button
                  variant="outline"
                  onClick={removePassword}
                  disabled={!currentPw}
                  className="text-destructive hover:text-destructive"
                >
                  Remove password
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="New password"
            />
            <Input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Confirm password"
            />
            <Button onClick={saveNewPassword} disabled={!newPw || !confirmPw}>
              Set password
            </Button>
          </div>
        )}
        {message && (
          <p className={`text-sm ${message.error ? "text-destructive" : "text-muted-foreground"}`}>
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>

    <BackupCard
      currentGroupCount={currentGroupCount}
      onGroupsImported={onGroupsImported}
      onMessage={setMessage}
    />
    </>
  );
}

function BackupCard({
  currentGroupCount,
  onGroupsImported,
  onMessage,
}: {
  currentGroupCount: number;
  onGroupsImported: (groups: BlockGroup[]) => void;
  onMessage: (message: { error: boolean; text: string }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    const json = await exportGroupsJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "blockera-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    onMessage({ error: false, text: "Groups exported to blockera-backup.json" });
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const imported = await importGroupsFromJSON(text);
      if (imported.length === 0) throw new Error("File contains no groups.");

      const ok = window.confirm(
        `Replace your current ${currentGroupCount} ${
          currentGroupCount === 1 ? "group" : "groups"
        } with ${imported.length} imported ${
          imported.length === 1 ? "group" : "groups"
        }?`
      );
      if (!ok) return;

      onGroupsImported(imported);
      onMessage({ error: false, text: `Imported ${imported.length} groups.` });
    } catch (err) {
      onMessage({
        error: true,
        text: err instanceof Error ? err.message : "Import failed.",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Backup</CardTitle>
        <CardDescription>
          Export your groups to a JSON file, or import a previously exported
          one. Import replaces all current groups. Useful before reinstalling
          the extension (e.g. after a forgotten password).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport} className="gap-2">
            Export groups
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Import groups
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          The export contains your groups and rules only — passwords and
          usage are never included.
        </p>
      </CardContent>
    </Card>
  );
}

export default App;
