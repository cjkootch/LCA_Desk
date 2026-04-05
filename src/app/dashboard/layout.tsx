import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-60">
        {children}
      </main>
      <OnboardingTour />
    </div>
  );
}
