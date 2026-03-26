"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, Menu, X, Swords, Trophy, BarChart3, Home, Layers, Map, TrendingUp, BarChart2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchCommand } from "@/components/layout/search-command";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/leaderboard/rm-1v1", label: "Leaderboards", icon: Trophy },
  { href: "/stats", label: "Statistics", icon: BarChart3 },
  { href: "/tier-list", label: "Tier List", icon: Layers },
  { href: "/maps", label: "Maps", icon: Map },
  { href: "/meta", label: "Meta", icon: TrendingUp },
  { href: "/compare",  label: "Compare",  icon: BarChart2 },
  { href: "/strategy", label: "Strategy", icon: Shield },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Swords className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold leading-tight tracking-tight">
              AoE2<span className="text-primary">Meta</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href.split("/").slice(0, 2).join("/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Desktop search */}
            <Button
              variant="outline"
              size="sm"
              className="hidden w-64 justify-start gap-2 text-muted-foreground md:flex"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
              <span>Search players...</span>
              <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                ⌘K
              </kbd>
            </Button>

            {/* Mobile search icon */}
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors md:hidden"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Mobile menu toggle */}
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute right-0 top-16 h-[calc(100vh-4rem)] w-72 border-l border-border bg-background p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href.split("/").slice(0, 2).join("/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
