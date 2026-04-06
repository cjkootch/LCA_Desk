"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Plus, DollarSign, CheckCircle, Receipt, TrendingUp, Calendar,
} from "lucide-react";
import { addPaymentLog, fetchPaymentLog, fetchPaymentLogStats, searchLcsRegister } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LogPaymentPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [entries, setEntries] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [certId, setCertId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  // Auto-suggest
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const loadData = () => {
    Promise.all([fetchPaymentLog(), fetchPaymentLogStats()])
      .then(([log, s]) => { setEntries(log); setStats(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleSupplierInput = (val: string) => {
    setSupplier(val);
    if (val.length >= 2) {
      searchLcsRegister(val).then(r => { setSuggestions(r); setShowSuggestions(r.length > 0); }).catch(() => {});
    } else { setSuggestions([]); setShowSuggestions(false); }
  };

  const handleSubmit = async () => {
    if (!supplier.trim() || !amount.trim()) { toast.error("Supplier and amount required"); return; }
    setSaving(true);
    try {
      await addPaymentLog({
        supplierName: supplier, supplierCertificateId: certId || undefined,
        amount, description: description || undefined,
        category: category || undefined, paymentDate,
      });
      toast.success("Payment logged");
      setSupplier(""); setCertId(""); setAmount(""); setDescription(""); setCategory("");
      setShowForm(false);
      loadData();
    } catch { toast.error("Failed to log payment"); }
    setSaving(false);
  };

  return (
    <div>
      <TopBar title="Payment Log" action={{ label: "Log Payment", onClick: () => setShowForm(true) }} />
      <div className="p-4 sm:p-8 max-w-4xl">
        <p className="text-sm text-text-secondary mb-6">
          Track supplier payments as they happen. These entries will be available to import into your next filing period.
        </p>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card className="p-3">
              <p className="text-xs text-text-muted">Unimported</p>
              <p className="text-xl font-bold text-text-primary">{stats.unimportedCount}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-text-muted">Total Spend</p>
              <p className="text-xl font-bold text-text-primary">${Number(stats.totalSpend).toLocaleString()}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-text-muted">Guyanese Spend</p>
              <p className="text-xl font-bold text-success">${Number(stats.guyaneseSpend).toLocaleString()}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-text-muted">Running LC Rate</p>
              <p className={cn("text-xl font-bold", stats.lcRate >= 50 ? "text-success" : "text-warning")}>{stats.lcRate}%</p>
            </Card>
          </div>
        )}

        {/* Quick add form */}
        {showForm && (
          <Card className="mb-6 border-accent/20">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Plus className="h-4 w-4 text-accent" /> Log a Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Input label="Supplier Name *" value={supplier}
                  onChange={(e) => handleSupplierInput(e.target.value)}
                  placeholder="Start typing to search LCS register..."
                />
                {showSuggestions && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-36 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button key={s.certId || s.legalName} type="button"
                        className="w-full text-left px-3 py-2 hover:bg-bg-primary text-sm border-b border-border-light last:border-0"
                        onClick={() => { setSupplier(s.legalName); setCertId(s.certId || ""); setShowSuggestions(false); }}>
                        <span className="font-medium">{s.legalName}</span>
                        {s.certId && <span className="text-[10px] text-accent ml-2">{s.certId}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Amount *" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                <Input label="Payment Date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="LCS Cert ID" value={certId} onChange={(e) => setCertId(e.target.value)} placeholder="LCSR-XXXXXXXX" />
                <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Equipment Rental" />
              </div>
              <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was purchased?" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button onClick={handleSubmit} loading={saving}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Log Payment
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Entries */}
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No payments logged yet"
            description="Log supplier payments as they happen. When filing time comes, import them directly into your report."
            actionLabel="Log First Payment"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">{e.supplierName}</p>
                      {e.supplierCertificateId && <Badge variant="success" className="text-[9px]">LCS</Badge>}
                      {e.imported && <Badge variant="default" className="text-[9px]">Imported</Badge>}
                    </div>
                    <p className="text-xs text-text-muted">{e.description || e.category || "No description"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-text-primary">${Number(e.amount).toLocaleString()}</p>
                    <p className="text-[10px] text-text-muted">{e.paymentDate || ""}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
