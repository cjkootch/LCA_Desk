"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import {
  ArrowLeft, MapPin, Calendar, Users, Clock, Building2, CheckCircle,
  Briefcase, Send,
} from "lucide-react";
import { fetchJobDetail, applyToJob } from "@/server/actions";
import { toast } from "sonner";
import Link from "next/link";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [coverNote, setCoverNote] = useState("");
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    fetchJobDetail(jobId)
      .then(setJob)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jobId]);

  const handleApply = async () => {
    setApplying(true);
    try {
      await applyToJob({ jobPostingId: jobId, coverNote: coverNote || undefined });
      setApplied(true);
      toast.success("Application submitted successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit application");
    }
    setApplying(false);
  };

  if (loading) {
    return (
      <>
        <SeekerTopBar title="Job Details" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  if (!job) {
    return (
      <>
        <SeekerTopBar title="Job Details" />
        <div className="p-8 text-center">
          <p className="text-text-secondary">Job not found or no longer available.</p>
          <Link href="/seeker/jobs">
            <Button variant="ghost" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Jobs
            </Button>
          </Link>
        </div>
      </>
    );
  }

  const isDeadlinePassed = job.applicationDeadline && new Date(job.applicationDeadline) < new Date();

  return (
    <>
      <SeekerTopBar
        title="Job Details"
        action={
          <Link href="/seeker/jobs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
        }
      />

      <div className="p-4 sm:p-8 max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-text-primary">{job.jobTitle}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Building2 className="h-4 w-4 text-text-muted" />
            <span className="text-sm text-text-secondary">{job.companyName}</span>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="default">{job.employmentCategory}</Badge>
            {job.employmentClassification && <Badge variant="default">{job.employmentClassification}</Badge>}
            <Badge variant="accent">{job.contractType}</Badge>
            {job.location && (
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <MapPin className="h-3 w-3" /> {job.location}
              </span>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {job.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{job.description}</p>
                </CardContent>
              </Card>
            )}

            {job.qualifications && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Qualifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{job.qualifications}</p>
                </CardContent>
              </Card>
            )}

            {job.guyaneseFirstStatement && (
              <Card className="border-accent/20 bg-accent-light">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-accent">Guyanese First Consideration</p>
                      <p className="text-xs text-text-secondary mt-1">{job.guyaneseFirstStatement}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Key details */}
            <Card>
              <CardContent className="p-4 space-y-3">
                {job.vacancyCount && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-text-muted" />
                    <span className="text-text-secondary">{job.vacancyCount} position{job.vacancyCount > 1 ? "s" : ""}</span>
                  </div>
                )}
                {job.applicationDeadline && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-text-muted" />
                    <span className="text-text-secondary">
                      Deadline: {new Date(job.applicationDeadline).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {job.startDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-text-muted" />
                    <span className="text-text-secondary">
                      Starts: {new Date(job.startDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {job.createdAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-text-muted" />
                    <span className="text-text-secondary">
                      Posted: {new Date(job.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Apply section */}
            <Card>
              <CardContent className="p-4">
                {applied ? (
                  <div className="text-center py-2">
                    <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                    <p className="text-sm font-medium text-text-primary">Application Submitted</p>
                    <p className="text-xs text-text-muted mt-1">
                      Track your application in{" "}
                      <Link href="/seeker/applications" className="text-accent hover:text-accent-hover">
                        My Applications
                      </Link>
                    </p>
                    <Link href="/seeker/jobs">
                      <Button variant="outline" size="sm" className="mt-3">Continue Browsing Jobs</Button>
                    </Link>
                  </div>
                ) : isDeadlinePassed ? (
                  <div className="text-center py-2">
                    <p className="text-sm font-medium text-danger">Application deadline has passed</p>
                  </div>
                ) : job.status !== "open" ? (
                  <div className="text-center py-2">
                    <p className="text-sm font-medium text-text-muted">This position has been filled</p>
                  </div>
                ) : !showApplyForm ? (
                  <Button className="w-full" onClick={() => setShowApplyForm(true)}>
                    <Send className="h-4 w-4 mr-2" /> Apply Now
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-text-primary">Cover Note (optional)</p>
                    <textarea
                      className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
                      rows={4}
                      placeholder="Why are you a good fit for this position?"
                      value={coverNote}
                      onChange={(e) => setCoverNote(e.target.value)}
                    />
                    <p className="text-[11px] text-text-muted">
                      Your profile details (name, email, category, nationality) will be included automatically.
                    </p>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={handleApply} loading={applying}>
                        Submit Application
                      </Button>
                      <Button variant="ghost" onClick={() => setShowApplyForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
