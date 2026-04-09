"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, X, Gift, MessageSquare, Trash2 } from "lucide-react";
import { submitCancellationFeedback, cancelSubscription, deleteAccount } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const REASONS = [
  { value: "too_expensive", label: "Too expensive", save: "We can offer 20% off your next 3 months." },
  { value: "not_using", label: "Not using it enough", save: "We can pause your subscription for up to 3 months — your data stays safe." },
  { value: "missing_features", label: "Missing features I need", save: "Tell us what's missing — we ship updates weekly and prioritize customer requests." },
  { value: "switching", label: "Switching to another tool", save: null },
  { value: "filing_complete", label: "Filing period is done", save: "Your next filing period will auto-create. Pause instead of canceling so you're ready." },
  { value: "other", label: "Other", save: null },
];

interface CancelAccountProps {
  hasPaidPlan?: boolean;
  userType?: "filer" | "supplier" | "seeker" | "secretariat";
}

export function CancelAccount({ hasPaidPlan, userType }: CancelAccountProps) {
  const [showCancel, setShowCancel] = useState(false);
  const [step, setStep] = useState<"reason" | "save" | "confirm" | "delete_confirm">("reason");
  const [reason, setReason] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [processing, setProcessing] = useState(false);

  const selectedReason = REASONS.find(r => r.value === reason);

  const handleCancelPlan = async () => {
    setProcessing(true);
    try {
      await submitCancellationFeedback({ reason, reasonDetail, feedback });
      await cancelSubscription();
      toast.success("Your subscription has been canceled. You still have access until the end of your billing period.");
      setShowCancel(false);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    }
    setProcessing(false);
  };

  const handleDeleteAccount = async () => {
    setProcessing(true);
    try {
      await submitCancellationFeedback({ reason, reasonDetail, feedback });
      await deleteAccount();
      toast.success("Your account has been deleted.");
      window.location.href = "/auth/login";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
    }
    setProcessing(false);
  };

  return (
    <>
      <Card className="border-danger/10">
        <CardHeader>
          <CardTitle className="text-sm text-danger">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasPaidPlan && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">Cancel Subscription</p>
                <p className="text-xs text-text-muted">Downgrade to free. Your data is preserved.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setShowCancel(true); setStep("reason"); setReason(""); }}>
                Cancel Plan
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Delete Account</p>
              <p className="text-xs text-text-muted">Permanently delete your account and all data.</p>
            </div>
            <Button variant="outline" size="sm" className="text-danger border-danger/30 hover:bg-danger/5"
              onClick={() => { setShowCancel(true); setStep("reason"); setReason(""); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cancellation flow dialog */}
      <Dialog open={showCancel} onOpenChange={open => { if (!open) setShowCancel(false); }}>
        <DialogContent className="max-w-md">
          {/* Step 1: Why are you leaving? */}
          {step === "reason" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-accent" />
                  We're sorry to see you go
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-text-secondary">Help us understand why so we can improve. This takes 30 seconds.</p>

              <div className="space-y-2 mt-3">
                {REASONS.map(r => (
                  <button key={r.value} onClick={() => setReason(r.value)}
                    className={cn("w-full text-left px-3 py-2.5 rounded-lg text-sm border-2 transition-all",
                      reason === r.value ? "border-accent bg-accent/5 text-accent font-medium" : "border-border hover:border-accent/30"
                    )}>
                    {r.label}
                  </button>
                ))}
              </div>

              {reason === "other" && (
                <textarea className="w-full h-16 mt-2 px-3 py-2 rounded-lg bg-bg-primary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  value={reasonDetail} onChange={e => setReasonDetail(e.target.value)} placeholder="Tell us more..." />
              )}

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowCancel(false)}>Never mind</Button>
                <Button disabled={!reason} onClick={() => {
                  if (selectedReason?.save) setStep("save");
                  else setStep("confirm");
                }}>Continue</Button>
              </div>
            </>
          )}

          {/* Step 2: Save attempt */}
          {step === "save" && selectedReason?.save && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-gold" />
                  Before you go...
                </DialogTitle>
              </DialogHeader>

              <div className="bg-gold/5 border border-gold/20 rounded-xl p-4 mt-2">
                <p className="text-sm text-text-primary font-medium mb-1">We'd like to help</p>
                <p className="text-sm text-text-secondary">{selectedReason.save}</p>
              </div>

              {reason === "missing_features" && (
                <textarea className="w-full h-20 mt-3 px-3 py-2 rounded-lg bg-bg-primary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="What features would make LCA Desk work for you?" />
              )}

              <div className="flex justify-end gap-2 mt-4">
                <Button onClick={() => { setShowCancel(false); toast.success("Great! We'll follow up with you."); }}>
                  Give it another try
                </Button>
                <Button variant="outline" onClick={() => setStep("confirm")}>
                  Continue canceling
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Final confirmation */}
          {step === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Confirm your choice
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3 mt-2">
                <textarea className="w-full h-16 px-3 py-2 rounded-lg bg-bg-primary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Any final feedback? (optional)" />

                {hasPaidPlan && (
                  <Button variant="outline" className="w-full justify-start gap-2 text-left"
                    onClick={handleCancelPlan} loading={processing}>
                    <X className="h-4 w-4 text-warning shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Cancel subscription only</p>
                      <p className="text-xs text-text-muted font-normal">Keep your account and data. Downgrade to free.</p>
                    </div>
                  </Button>
                )}

                <Button variant="outline" className="w-full justify-start gap-2 text-left border-danger/30 hover:bg-danger/5"
                  onClick={() => setStep("delete_confirm")}>
                  <Trash2 className="h-4 w-4 text-danger shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-danger">Delete my account</p>
                    <p className="text-xs text-text-muted font-normal">Permanently delete account, data, and all history.</p>
                  </div>
                </Button>
              </div>

              <div className="flex justify-end mt-3">
                <Button variant="outline" onClick={() => setShowCancel(false)}>Keep my account</Button>
              </div>
            </>
          )}

          {/* Step 4: Delete confirmation */}
          {step === "delete_confirm" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-danger" />
                  This cannot be undone
                </DialogTitle>
              </DialogHeader>

              <div className="bg-danger/5 border border-danger/20 rounded-xl p-4 mt-2">
                <p className="text-sm text-text-primary font-medium mb-2">The following will be permanently deleted:</p>
                <ul className="text-xs text-text-secondary space-y-1">
                  <li>• Your account and login credentials</li>
                  <li>• All filing data, reports, and submissions</li>
                  <li>• Job applications and saved items</li>
                  <li>• Profile, resume, and talent pool listing</li>
                  {hasPaidPlan && <li>• Active subscription (canceled immediately)</li>}
                </ul>
                <p className="text-xs text-text-muted mt-2">A data archive will be saved for compliance records.</p>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setStep("confirm")}>Go back</Button>
                <Button variant="danger" onClick={handleDeleteAccount} loading={processing}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete my account permanently
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
