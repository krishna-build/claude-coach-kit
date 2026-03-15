import { useState, useRef, useCallback } from "react";
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle, File } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

interface Props {
  onClose: () => void;
  onImported: () => void;
}

const FIELD_MAP: Record<string, string> = {
  email: "email", "e-mail": "email", "email address": "email",
  name: "first_name", "full name": "first_name", "fullname": "first_name", "first name": "first_name", "first_name": "first_name",
  "last name": "last_name", "last_name": "last_name",
  phone: "phone", mobile: "phone", "phone number": "phone", "mobile number": "phone",
  tags: "tags", tag: "tags",
  source: "source",
};

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const rows = lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  }).filter(r => {
    const emailKey = Object.keys(r).find(k => k === "email" || k === "e-mail" || k === "email address");
    return emailKey && r[emailKey];
  });
  return { headers, rows };
}

export default function ImportContactsModal({ onClose, onImported }: Props) {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) { setError("Please upload a .csv file"); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.rows.length === 0) { setError("No valid rows found. Make sure your CSV has an 'email' column."); return; }
      setCsvData(parsed);
      setStep("preview");
      setError("");
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = async () => {
    if (!csvData) return;
    setImporting(true);
    setProgress(0);

    const contacts = csvData.rows.map(row => {
      const contact: Record<string, any> = { source: "import", tags: ["import"] };
      Object.entries(row).forEach(([header, value]) => {
        const mapped = FIELD_MAP[header];
        if (mapped && value) {
          if (mapped === "tags") {
            contact.tags = [...(contact.tags || ["import"]), value];
          } else {
            contact[mapped] = value;
          }
        }
      });
      return contact;
    }).filter(c => c.email);

    let imported = 0;
    const batchSize = 50;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      await supabase.from("automation_contacts").upsert(batch, { onConflict: "email" });
      imported += batch.length;
      setProgress(Math.round((imported / contacts.length) * 100));
    }

    setResult({ imported, skipped: csvData.rows.length - contacts.length });
    setStep("done");
    setImporting(false);
    setTimeout(() => onImported(), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Import Contacts</p>
              <p className="text-[11px] text-muted-foreground">Upload a CSV file to import contacts in bulk</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-0 px-5 py-3 border-b border-border/20">
          {(["upload", "preview", "done"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-0">
              <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full transition-all ${step === s ? "bg-primary/15 text-primary" : ["upload","preview","done"].indexOf(s) < ["upload","preview","done"].indexOf(step) ? "text-emerald-400" : "text-muted-foreground/40"}`}>
                <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-black" style={{ borderColor: "currentColor" }}>{i + 1}</span>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </div>
              {i < 2 && <div className="w-6 h-px bg-border/30 mx-1" />}
            </div>
          ))}
        </div>

        <div className="p-5">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${isDragging ? "border-primary bg-primary/5" : "border-border/40 hover:border-primary/40 hover:bg-primary/3"}`}
              >
                <Upload className={`w-10 h-10 mx-auto mb-3 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground/30"}`} />
                <p className="text-sm font-semibold text-foreground">Drop your CSV file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>

              <div className="px-3 py-2.5 rounded-xl bg-muted/30 text-[11px] text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Required columns:</p>
                <code className="font-mono">email</code> (required) · <code className="font-mono">name</code> · <code className="font-mono">phone</code> · <code className="font-mono">tags</code> · <code className="font-mono">source</code>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Preview */}
          {step === "preview" && csvData && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <File className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{fileName}</p>
                  <p className="text-xs text-emerald-400">{csvData.rows.length} contacts ready to import</p>
                </div>
              </div>

              {/* Preview table */}
              <div className="border border-border/30 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        {csvData.headers.slice(0, 4).map(h => (
                          <th key={h} className="text-left px-3 py-2 text-muted-foreground font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t border-border/20">
                          {csvData.headers.slice(0, 4).map(h => (
                            <td key={h} className="px-3 py-2 text-foreground truncate max-w-[120px]">{row[h] || "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvData.rows.length > 5 && (
                  <p className="text-center text-xs text-muted-foreground py-2 border-t border-border/20">
                    +{csvData.rows.length - 5} more rows
                  </p>
                )}
              </div>

              {importing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Importing...</span><span>{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep("upload")} disabled={importing} className="flex-1 py-2.5 rounded-xl bg-muted/50 text-muted-foreground text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40">
                  Back
                </button>
                <button onClick={handleImport} disabled={importing} className="flex-1 py-2.5 rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5">
                  <Upload className="w-4 h-4" />
                  {importing ? `Importing... ${progress}%` : `Import ${csvData.rows.length} Contacts`}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === "done" && result && (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <p className="text-xl font-black text-foreground">{result.imported} contacts imported!</p>
                {result.skipped > 0 && <p className="text-sm text-muted-foreground mt-1">{result.skipped} rows skipped (missing email)</p>}
              </div>
              <p className="text-xs text-muted-foreground">All contacts tagged with "import" · Duplicates were updated</p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
