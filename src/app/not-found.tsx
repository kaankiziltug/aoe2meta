import Link from "next/link";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <Swords className="h-16 w-16 text-muted-foreground/30" />
      <h1 className="mt-6 text-4xl font-bold">404</h1>
      <p className="mt-2 text-muted-foreground">
        This page has been lost to the ages.
      </p>
      <Link href="/">
        <Button className="mt-6">Return Home</Button>
      </Link>
    </div>
  );
}
