import { useEffect, useState } from "react";
import { Shield, Globe, Settings, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getGroups, type BlockGroup } from "@/utils/storage";
import "@/assets/tailwind.css";

function App() {
  const [groups, setGroups] = useState<BlockGroup[]>([]);

  useEffect(() => {
    getGroups().then(setGroups);
  }, []);

  const totalSites = groups.reduce((sum, g) => sum + g.sites.length, 0);

  const openSettings = () => {
    browser.runtime.openOptionsPage();
    window.close();
  };

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
          <Button onClick={openSettings} className="w-full gap-2">
            <Settings className="h-4 w-4" />
            Open settings
          </Button>

          {groups.length > 0 ? (
            <div className="space-y-1">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {group.allowOverride ? (
                      <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm truncate">{group.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {group.sites.length} {group.sites.length === 1 ? "site" : "sites"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              No block groups yet — add one in settings
            </p>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            {totalSites} {totalSites === 1 ? "site" : "sites"} blocked in {groups.length}{" "}
            {groups.length === 1 ? "group" : "groups"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
