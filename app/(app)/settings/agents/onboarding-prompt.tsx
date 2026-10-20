"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/lib/clipboard";

/** A prompt the person pastes into their own agent so it can pair itself. */
export function OnboardingPrompt({ prompt }: { prompt: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    const ok = await copyText(prompt);
    if (!ok) {
      toast("Couldn't copy. Select the prompt and copy it.", "error");
      return;
    }
    setCopied(true);
    toast("Prompt copied. Paste it into your agent.", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-4 space-y-3">
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">
        {prompt}
      </pre>
      <Button type="button" variant="secondary" onClick={copy}>
        {copied ? "Copied" : "Copy prompt"}
      </Button>
    </div>
  );
}
