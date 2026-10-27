'use client';

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Agent = {
  id: string;
  name: string;
  model: string | null;
  level: string;
  status: string;
};

export function AgentSummonPad({ bugId }: { bugId: string }) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [brief, setBrief] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && agents.length === 0 && !loadingAgents) {
      setLoadingAgents(true);
      fetch("/api/dashboard/agents", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          const list = Array.isArray(data.agents) ? data.agents : [];
          setAgents(list);
          if (list.length > 0) setSelectedAgentId(list[0].id);
        })
        .catch(() => setAgents([]))
        .finally(() => setLoadingAgents(false));
    }
  }, [open, agents.length, loadingAgents]);

  useEffect(() => {
    if (open) {
      setTimeout(() => selectRef.current?.focus(), 0);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  const handleSend = () => {
    const agent = agents.find((a) => a.id === selectedAgentId);
    const agentName = agent?.name ?? "Unknown agent";
    const content = `[Agent Brief] @${agentName} ${brief.trim()}`;
    console.log("[Agent Summon] Create comment on bug", bugId, content);
    // TODO: replace with prisma comment creation server action
    setOpen(false);
    setBrief("");
  };

  const paperStyle: React.CSSProperties = {
    backgroundColor: "#fbf7f1",
    color: "#232019",
  };

  const lineStyle = {
    backgroundImage:
      "repeating-linear-gradient(to bottom, transparent, transparent 28px, #232019 28px, #232019 29px)",
    backgroundRepeat: "repeat-y",
  } as React.CSSProperties;

  return (
    <div className="agent-summon-pad">
      <Button
        ref={triggerRef}
        variant="secondary"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="stamp-btn"
        style={{
          backgroundColor: "#ad8551",
          color: "#fff9ec",
          borderColor: "#5f4728",
          boxShadow: "0 2px 0 #6b5030",
          fontWeight: 800,
          letterSpacing: "0.05em",
        }}
      >
        Summon Agent
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="briefing-title"
          ref={dialogRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[12px] border border-[#232019] p-5 shadow-[8px_8px_0_#232019]"
            style={paperStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="briefing-title" className="text-lg font-extrabold tracking-tight">
              Briefing Pad
            </h2>

            <div className="mt-4 space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wide">
                Agent
                <Select
                  ref={selectRef}
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  disabled={loadingAgents || agents.length === 0}
                  className="!border-[#232019] !bg-[#fffef9] !text-[#232019]"
                  style={{ backgroundColor: "#fffef9", color: "#232019", borderColor: "#232019" }}
                >
                  {loadingAgents && <option>Loading agents…</option>}
                  {!loadingAgents && agents.length === 0 && <option>No agents</option>}
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.level}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="block text-xs font-bold uppercase tracking-wide">
                Brief
                <div className="rounded-[3px] border border-[#232019] bg-[#fffef9] p-1">
                  <Textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="Write a short brief for the agent…"
                    rows={6}
                    style={{
                      ...paperStyle,
                      backgroundColor: "transparent",
                      border: "none",
                      outline: "none",
                      resize: "vertical",
                      ...lineStyle,
                      paddingLeft: "8px",
                      lineHeight: "28px",
                    }}
                    className="!border-0 !bg-transparent !shadow-none focus:ring-0"
                  />
                </div>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={!selectedAgentId || brief.trim().length === 0}
                  style={{
                    backgroundColor: "#ad8551",
                    color: "#fff9ec",
                    borderColor: "#5f4728",
                    boxShadow: "0 2px 0 #6b5030",
                  }}
                  className="font-extrabold"
                >
                  Send Brief
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .agent-summon-pad .stamp-btn:hover {
          transform: translate(-1px, -1px);
          box-shadow: 0 3px 0 #6b5030;
        }
        .agent-summon-pad .stamp-btn:active {
          transform: translate(1px, 1px);
          box-shadow: 0 1px 0 #6b5030;
        }
      `}</style>
    </div>
  );
}
