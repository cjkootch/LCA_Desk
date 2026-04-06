"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function CertSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0fdf4] to-white">
      <div className="border-b border-border bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <Link href="/"><Image src="/logo-full.png" alt="LCA Desk" width={120} height={35} /></Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="inline-flex p-4 rounded-full bg-success/10 mb-6">
          <CheckCircle className="h-12 w-12 text-success" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-text-primary mb-3">Application Submitted!</h1>
        <p className="text-text-secondary mb-8">
          Your LCS registration application has been received and payment confirmed.
          Our team will review your documents and submit to the Local Content Secretariat.
        </p>

        <Card className="text-left mb-8">
          <CardContent className="p-5 space-y-3 text-sm">
            <h3 className="font-semibold text-text-primary">What happens next:</h3>
            <div className="space-y-2">
              <p className="flex items-start gap-2 text-text-secondary">
                <span className="text-accent font-bold">1.</span>
                We review your documents for completeness (1-2 business days)
              </p>
              <p className="flex items-start gap-2 text-text-secondary">
                <span className="text-accent font-bold">2.</span>
                If anything is missing, we&apos;ll email you with specific instructions
              </p>
              <p className="flex items-start gap-2 text-text-secondary">
                <span className="text-accent font-bold">3.</span>
                We submit your application to the Local Content Secretariat
              </p>
              <p className="flex items-start gap-2 text-text-secondary">
                <span className="text-accent font-bold">4.</span>
                Once approved, your LCS Certificate ID is added to your profile automatically
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
          <Link href="/register-lcs/status">
            <Button variant="outline">Track Application Status</Button>
          </Link>
          <Link href="/dashboard">
            <Button>Go to Dashboard <ArrowRight className="h-4 w-4 ml-1" /></Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
