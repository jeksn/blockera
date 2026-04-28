import { Settings, Shield, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import "@/assets/tailwind.css";

function App() {
  const openOptions = () => {
    browser.runtime.openOptionsPage();
    window.close();
  };

  return (
    <div className="w-[320px] p-4 bg-background">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Annoime</CardTitle>
          </div>
          <CardDescription>Stay focused, block distractions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={openOptions} className="w-full" variant="default">
            <Settings className="mr-2 h-4 w-4" />
            Open Settings
          </Button>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3" />
            <span>Add sites to block in settings</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
