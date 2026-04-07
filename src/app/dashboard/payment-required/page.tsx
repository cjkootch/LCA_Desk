import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, CreditCard, Shield, ArrowRight } from "lucide-react";

export default async function PaymentRequiredPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const isUnpaid = reason === "unpaid";

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full text-center">
        <Image src="/logo-full.png" alt="LCA Desk" width={160} height={48} className="mx-auto mb-8" />

        <div className="rounded-2xl border border-danger/20 bg-danger-light p-8 mb-6">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-full bg-danger/10 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-danger" />
            </div>
          </div>

          <h1 className="text-2xl font-heading font-bold text-text-primary mb-2">
            {isUnpaid ? "Payment is required to continue" : "Your subscription has ended"}
          </h1>

          <p className="text-text-secondary text-sm mb-6">
            {isUnpaid
              ? "Your payment could not be processed after multiple attempts. Update your payment method to restore access immediately."
              : "Your LCA Desk subscription has been cancelled due to non-payment. Your data is safe and waiting."}
          </p>

          <Link href="/dashboard/settings/billing"
            className="flex items-center justify-center gap-2 w-full bg-danger text-white rounded-xl px-6 py-3.5 text-sm font-semibold hover:bg-danger/90 transition-colors mb-3">
            <CreditCard className="h-4 w-4" />
            Update Payment Method
            <ArrowRight className="h-4 w-4" />
          </Link>

          <p className="text-xs text-text-muted">Access restored immediately upon successful payment</p>
        </div>

        <div className="rounded-xl border border-border bg-bg-card p-4 flex items-start gap-3 text-left">
          <Shield className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-text-primary">Your data is safe</p>
            <p className="text-xs text-text-secondary mt-0.5">
              All your compliance data, filing history, and documents are preserved.
              Nothing is deleted. Restore access now to continue filing.
            </p>
          </div>
        </div>

        <p className="text-xs text-text-muted mt-6">
          Having trouble? <a href="mailto:support@lcadesk.com" className="text-accent hover:underline">Contact support</a> and we&apos;ll resolve it immediately.
        </p>
      </div>
    </div>
  );
}
