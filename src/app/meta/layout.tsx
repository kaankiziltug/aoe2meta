import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meta Report",
  description:
    "Age of Empires II meta analysis. See which civilizations improved or declined in the latest patch update.",
  alternates: { canonical: "https://aoe2meta.com/meta" },
  openGraph: {
    title: "AoE2 Meta Report — AoE2Meta",
    description:
      "Age of Empires II meta analysis. See which civilizations improved or declined in the latest patch update.",
    url: "https://aoe2meta.com/meta",
  },
};

export default function MetaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
