import { useEffect, useState } from "react";
import { Shield, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGroups, getTodayTotals } from "@/utils/storage";
import "@/assets/tailwind.css";

function App() {
  const [today, setToday] = useState<{ seconds: number; attempts: number } | null>(null);
  const [totals, setTotals] = useState<{ sites: number; groups: number } | null>(null);

  useEffect(() => {
    getTodayTotals().then(setToday);
    getGroups().then((groups) =>
      setTotals({
        sites: groups.reduce((sum, g) => sum + g.sites.length, 0),
        groups: groups.length,
      })
    );
  }, []);

  const openSettings = () => {
    browser.runtime.openOptionsPage();
    window.close();
  };

  return (
    <div className="w-[280px] p-4 bg-background space-y-4">
      <div className="flex items-center gap-2.5">
        <Shield className="h-6 w-6 text-primary shrink-0" />
        <div>
          <h2 className="text-base font-semibold leading-none">Blockera</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Stay focused, block distractions
          </p>
        </div>
      </div>

      <Button onClick={openSettings} className="w-full gap-2">
        <Settings className="h-4 w-4" />
        Open settings
      </Button>

      <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
        <div>
          <p className="text-xl font-semibold leading-tight">
            {today ? Math.round(today.seconds / 60) : "–"}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            min on blocked sites today
          </p>
        </div>
        <div>
          <p className="text-xl font-semibold leading-tight">
            {today ? today.attempts : "–"}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            blocks shown today
          </p>
        </div>
      </div>

      {totals && (
        <p className="text-[11px] text-muted-foreground text-center">
          {totals.sites} {totals.sites === 1 ? "site" : "sites"} in{" "}
          {totals.groups} {totals.groups === 1 ? "group" : "groups"}
        </p>
      )}
    </div>
  );
}

export default App;
