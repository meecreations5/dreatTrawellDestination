"use client";

import { useState } from "react";
import {
  DownloadCloud,
  Loader2,
  RefreshCcw,
  Sparkles
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { importDefaultCommunicationTemplates } from "@/lib/importDefaultCommunicationTemplates";

function getUserName(user) {
  return (
    user?.displayName ||
    user?.name ||
    user?.email ||
    "Team Member"
  );
}

export default function ImportDefaultTemplatesButton({
  onImported
}) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const runImport = async mode => {
    if (!user) {
      alert("User not available");
      return;
    }

    if (mode === "sync") {
      const confirmed = window.confirm(
        "This will sync default template content from code and may overwrite existing default template text. Continue?"
      );

      if (!confirmed) return;
    }

    try {
      if (mode === "sync") {
        setSyncing(true);
      } else {
        setLoading(true);
      }

      setResult(null);

      const response = await importDefaultCommunicationTemplates({
        mode,
        importedByUid: user.uid || "",
        importedByName: getUserName(user),
        importedByEmail: user.email || ""
      });

      setResult(response);

      alert(response.message || "Default templates imported");

      onImported?.(response);
    } catch (error) {
      console.error("Failed to import default templates:", error);
      alert("Failed to import default templates");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <button
        type="button"
        onClick={() => runImport("missing")}
        disabled={loading || syncing}
        className="
          inline-flex items-center justify-center gap-2
          rounded-xl bg-blue-600 px-4 py-2.5
          text-sm font-semibold text-white
          hover:bg-blue-700 disabled:opacity-60
        "
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <DownloadCloud className="h-4 w-4" />
        )}
        Import Defaults
      </button>

      <button
        type="button"
        onClick={() => runImport("sync")}
        disabled={loading || syncing}
        className="
          inline-flex items-center justify-center gap-2
          rounded-xl border border-slate-200 bg-white px-4 py-2.5
          text-sm font-semibold text-slate-700
          hover:bg-slate-50 disabled:opacity-60
        "
      >
        {syncing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCcw className="h-4 w-4" />
        )}
        Sync Defaults
      </button>

      {result && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          <Sparkles className="h-3.5 w-3.5" />
          {result.created} created · {result.updated} updated · {result.skipped} skipped
        </div>
      )}
    </div>
  );
}