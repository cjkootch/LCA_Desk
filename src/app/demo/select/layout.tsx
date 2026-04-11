import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Choose Your Demo View — LCA Desk",
  description: "Explore LCA Desk from any perspective: Contractor filing, Secretariat review, or Job Seeker portal.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
