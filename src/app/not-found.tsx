import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="text-center max-w-md px-6">
        <Image src="/logo-full.svg" alt="LCA Desk" width={160} height={48} className="mx-auto mb-8" />
        <h1 className="text-6xl font-bold text-accent mb-2">404</h1>
        <h2 className="text-xl font-heading font-semibold text-text-primary mb-2">Page Not Found</h2>
        <p className="text-sm text-text-secondary mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/dashboard">
            <Button className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
          <Link href="https://lcadesk.com">
            <Button variant="outline">Visit lcadesk.com</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
