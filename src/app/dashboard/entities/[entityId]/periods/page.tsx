import { redirect } from "next/navigation";

export default function PeriodsRedirect({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  // Redirect to entity detail which shows periods
  return redirect(`/dashboard/entities`);
}
