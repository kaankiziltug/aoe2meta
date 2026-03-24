import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Player Comparison",
  description:
    "Compare two Age of Empires II players head-to-head. Side-by-side ELO ratings, win rates, and civilization statistics.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
