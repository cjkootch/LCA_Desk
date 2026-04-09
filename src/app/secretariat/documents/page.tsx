"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileText, Download, Upload, FolderOpen, Calendar } from "lucide-react";
import { fetchSecretariatDocuments } from "@/server/actions";

export default function DocumentLibraryPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchSecretariatDocuments().then(setDocs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? docs.filter(d =>
        d.entityName?.toLowerCase().includes(search.toLowerCase()) ||
        d.tenantName?.toLowerCase().includes(search.toLowerCase()) ||
        d.uploadedFileName?.toLowerCase().includes(search.toLowerCase()) ||
        d.reportType?.toLowerCase().includes(search.toLowerCase())
      )
    : docs;

  const withFiles = filtered.filter(d => d.uploadedFileName);
  const withoutFiles = filtered.filter(d => !d.uploadedFileName);

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-4">
        <FolderOpen className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Document Library</h1>
          <p className="text-sm text-text-secondary">{docs.length} submissions · {withFiles.length} with attached files</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, file name, report type..." className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-text-muted">No submissions found.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => (
            <Card key={d.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-lg shrink-0 ${d.uploadedFileName ? "bg-accent/10" : "bg-bg-primary"}`}>
                    {d.uploadedFileName ? <FileText className="h-5 w-5 text-accent" /> : <Upload className="h-5 w-5 text-text-muted" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{d.entityName}</p>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span>{d.tenantName}</span>
                      <span>·</span>
                      <span>{d.reportType?.replace(/_/g, " ")} FY{d.fiscalYear}</span>
                      {d.submittedAt && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-0.5"><Calendar className="h-3 w-3" />{new Date(d.submittedAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                    {d.uploadedFileName && (
                      <p className="text-xs text-accent mt-0.5 truncate">{d.uploadedFileName}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={d.submissionMethod === "platform" ? "accent" : d.submissionMethod === "upload" ? "default" : "warning"} className="text-xs">
                    {d.submissionMethod === "platform" ? "Platform" : d.submissionMethod === "upload" ? "File Upload" : "Email"}
                  </Badge>
                  {d.uploadedFileKey && (
                    <a href={`/api/submission/download?key=${encodeURIComponent(d.uploadedFileKey)}&name=${encodeURIComponent(d.uploadedFileName || "file")}`}>
                      <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" /></Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
