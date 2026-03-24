import { Swords } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Swords className="h-4 w-4" />
            <span className="text-sm">
              AoE2Meta — Age of Empires II Statistics
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Not affiliated with Microsoft or Xbox Game Studios</span>
          </div>
        </div>
        <Separator className="my-4 opacity-50" />
        <p className="text-center text-xs text-muted-foreground/60">
          Age of Empires II: Definitive Edition is a trademark of Microsoft Corporation.
        </p>
      </div>
    </footer>
  );
}
