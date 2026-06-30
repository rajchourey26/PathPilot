import { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  Sparkles, 
  Copy, 
  Check, 
  Clock, 
  Ban, 
  ArrowRight, 
  Play,
  Bookmark,
  TrendingUp,
  Share2,
  Calendar,
  Maximize2,
  Minimize2
} from "lucide-react";
import { PathResponse, PathStep } from "../types";
import ActiveStepTimer from "./ActiveStepTimer";

interface PathDashboardProps {
  path: PathResponse;
  onSave?: () => void;
  isSaved?: boolean;
  availableHours?: number | null;
  deadlineDate?: string | null;
  focusMode: boolean;
  setFocusMode: (val: boolean) => void;
}

export default function PathDashboard({ 
  path, 
  onSave, 
  isSaved = false,
  availableHours,
  deadlineDate,
  focusMode,
  setFocusMode
}: PathDashboardProps) {
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [checkedMustDos, setCheckedMustDos] = useState<Record<number, boolean>>({});
  const [nextActionDone, setNextActionDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTimerStepIndex, setActiveTimerStepIndex] = useState<number | null>(null);

  // START RIGHT NOW sprint timer state
  const [sprintSeconds, setSprintSeconds] = useState(300);
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);

  // Reset completion states when path changes
  useEffect(() => {
    setCheckedSteps({});
    setCheckedMustDos({});
    setNextActionDone(false);
    setActiveTimerStepIndex(null);
    setSprintSeconds(300);
    setSprintRunning(false);
    setSprintDone(false);
  }, [path]);

  // Sprint timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (sprintRunning && sprintSeconds > 0) {
      interval = setInterval(() => {
        setSprintSeconds((prev) => prev - 1);
      }, 1000);
    } else if (sprintSeconds === 0) {
      setSprintRunning(false);
      setSprintDone(true);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sprintRunning, sprintSeconds]);

  const toggleStep = (index: number) => {
    setCheckedSteps((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleMustDo = (index: number) => {
    setCheckedMustDos((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "high":
        return "bg-rose-500/20 border-rose-500/40 text-rose-300";
      case "medium":
        return "bg-amber-500/20 border-amber-500/40 text-amber-300";
      default:
        return "bg-emerald-500/20 border-emerald-500/40 text-emerald-300";
    }
  };

  // Calculations for progress
  const totalStepsCount = path.steps.length;
  const completedStepsCount = Object.values(checkedSteps).filter(Boolean).length;
  const stepProgressPercentage = totalStepsCount > 0 
    ? Math.round((completedStepsCount / totalStepsCount) * 100) 
    : 0;

  const totalMustDosCount = path.must_do.length;
  const completedMustDosCount = Object.values(checkedMustDos).filter(Boolean).length;
  const mustDoProgressPercentage = totalMustDosCount > 0
    ? Math.round((completedMustDosCount / totalMustDosCount) * 100)
    : 0;

  // General path completion (average)
  const totalProgress = Math.round(
    (stepProgressPercentage * 0.7) + (mustDoProgressPercentage * 0.2) + (nextActionDone ? 10 : 0)
  );

  const handleCopyMarkdown = () => {
    const stepsMarkdown = path.steps
      .map((s, i) => `${i + 1}. **${s.title}** (${s.estimated_minutes}m)\n   ${s.description}`)
      .join("\n");

    const text = `# PathPilot: Tactical Action Path
**Minimum Viable Outcome (MVO):** ${path.minimum_viable_outcome}
**Risk Level:** ${path.risk_level}

## Immediate Next Action (Procrastination Killer)
> ${path.next_action}

## Must-Do Items (The Critical Focus)
${path.must_do.map((m) => `- [ ] ${m}`).join("\n")}

## Skip Items (Ruthless Simplicity - DO NOT DO)
${path.skip.map((s) => `- [x] ${s}`).join("\n")}

## Chronological Action Path (${path.estimated_total_hours} Hours Total)
${stepsMarkdown}

*Tactical Quote:* "${path.efficiency_quote}"`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
          console.warn("Clipboard API failed, using legacy fallback:", err);
          fallbackCopyText(text);
        });
    } else {
      fallbackCopyText(text);
    }
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        console.error("Fallback copy command was unsuccessful");
      }
    } catch (err) {
      console.error("Fallback copy failed:", err);
    }
  };

  // Google Calendar Export Logic
  const handleExportToGoogleCalendar = () => {
    if (!path.steps || path.steps.length === 0) return;

    // Google Calendar template dates expects YYYYMMDD/YYYYMMDD for full-day event on a specific date
    let dateStr = "";
    if (deadlineDate) {
      try {
        const deadline = new Date(deadlineDate);
        const dy = deadline.getFullYear();
        const dm = String(deadline.getMonth() + 1).padStart(2, '0');
        const dd = String(deadline.getDate()).padStart(2, '0');
        dateStr = `${dy}${dm}${dd}/${dy}${dm}${dd}`;
      } catch (e) {
        // Fallback to today
      }
    }
    if (!dateStr) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      dateStr = `${y}${m}${d}/${y}${m}${d}`;
    }

    const title = encodeURIComponent(`PathPilot Action Plan: ${path.minimum_viable_outcome.slice(0, 50)}...`);
    const stepsText = path.steps
      .map((s, i) => `Step ${i + 1}: ${s.title} (${s.estimated_minutes}m)\n- ${s.description}`)
      .join("\n\n");
    
    const mustDoText = path.must_do.map((item) => `[ ] ${item}`).join("\n");
    const skipText = path.skip.map((item) => `[Skip] ${item}`).join("\n");

    const details = encodeURIComponent(
      `Goal / Minimum Viable Outcome (MVO):\n${path.minimum_viable_outcome}\n\n` +
      `Estimated Hours: ${path.estimated_total_hours}h\n\n` +
      `=== CRITICAL MUST-DOS ===\n${mustDoText}\n\n` +
      `=== RUTHLESS SKIP LIST ===\n${skipText}\n\n` +
      `=== CHRONOLOGICAL STEPS ===\n${stepsText}\n\n` +
      `Generated by PathPilot.`
    );
    
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dateStr}`;
    window.open(url, '_blank');
  };

  const handleToggleSprint = () => {
    if (sprintDone) {
      setSprintSeconds(300);
      setSprintDone(false);
      setSprintRunning(true);
    } else {
      setSprintRunning(!sprintRunning);
    }
  };

  const handleResetSprint = () => {
    setSprintSeconds(300);
    setSprintRunning(false);
    setSprintDone(false);
  };

  const formatSprintTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  };

  // Days left calculation relative to 2026-06-27
  const getDaysLeftText = () => {
    if (!deadlineDate) return null;
    const today = new Date("2026-06-27");
    const deadline = new Date(deadlineDate);
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const formattedDate = deadline.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    if (diffDays < 0) {
      return { 
        text: `Overdue by ${Math.abs(diffDays)} day(s) (${formattedDate})`, 
        color: "text-red-300 bg-red-950/40 border-red-900" 
      };
    } else if (diffDays === 0) {
      return { 
        text: `Due Today (${formattedDate})`, 
        color: "text-amber-300 bg-amber-950/40 border-amber-900" 
      };
    } else if (diffDays === 1) {
      return { 
        text: `1 Day Left (${formattedDate})`, 
        color: "text-orange-300 bg-orange-950/40 border-orange-900" 
      };
    } else {
      return { 
        text: `${diffDays} Days Left (${formattedDate})`, 
        color: "text-sky-300 bg-sky-950/40 border-sky-900" 
      };
    }
  };

  const daysLeftBadge = getDaysLeftText();

  // Feasibility warning banner renderer
  const renderFeasibilityBanner = () => {
    if (availableHours === null || availableHours === undefined) return null;
    const planExceeds = path.estimated_total_hours > availableHours;

    if (planExceeds) {
      return (
        <div id="feasibility-banner" className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold text-red-900">⚠ Schedule Constraint Conflict</h4>
            <p className="leading-relaxed">⚠ This plan needs more time than you have. Scope has been cut to fit your limit.</p>
          </div>
        </div>
      );
    } else {
      return (
        <div id="feasibility-banner" className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold text-emerald-900 font-semibold">✓ Feasibility Check Passed</h4>
            <p className="leading-relaxed">✅ Plan fits within your time limit.</p>
          </div>
        </div>
      );
    }
  };

  return (
    <div id="path-dashboard-wrapper" className="space-y-6">
      {/* Top action row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-natural-must-accent animate-pulse" />
          <span className="text-xs font-mono text-natural-text-muted">Path Generated Successfully</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-toggle-focus-mode"
            onClick={() => setFocusMode(!focusMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
              focusMode
                ? "bg-amber-500 hover:bg-amber-600 border-amber-500 text-white shadow-sm"
                : "bg-white border-natural-border text-natural-text-main hover:bg-natural-panel"
            }`}
            title={focusMode ? "Deactivate Focus Mode to restore standard controls" : "Activate Focus Mode to eliminate peripheral elements"}
          >
            {focusMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit Focus Mode</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Focus Mode</span>
              </>
            )}
          </button>

          {onSave && (
            <button
              id="btn-save-path"
              onClick={onSave}
              disabled={isSaved}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                isSaved
                  ? "bg-natural-panel border-natural-border text-natural-text-muted"
                  : "bg-white border-natural-border text-natural-text-main hover:bg-natural-panel hover:border-natural-border"
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? "fill-natural-text-muted text-natural-text-muted" : ""}`} />
              {isSaved ? "Saved to History" : "Save to History"}
            </button>
          )}

          <button
            id="btn-export-calendar-top"
            onClick={handleExportToGoogleCalendar}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-natural-border bg-white text-natural-text-main hover:bg-natural-panel hover:border-natural-border text-xs font-medium cursor-pointer transition-all"
            title="Add all generated roadmap steps to Google Calendar"
          >
            <Calendar className="w-3.5 h-3.5 text-natural-brand" />
            <span>📅 Add all to Calendar</span>
          </button>

          <button
            id="btn-copy-markdown"
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-natural-border bg-white text-natural-text-main hover:bg-natural-panel hover:border-natural-border text-xs font-medium cursor-pointer transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-natural-must-accent" /> : <Copy className="w-3.5 h-3.5 text-natural-text-muted" />}
            {copied ? "Copied Path!" : "Copy Path"}
          </button>
        </div>
      </div>

      {/* Feasibility Warning Banner */}
      {!focusMode && renderFeasibilityBanner()}

      {/* Fallback Notification Banner */}
      {path.is_fallback && (
        <div 
          id="fallback-notification-banner" 
          className="bg-amber-500/10 border border-amber-500/20 text-amber-800 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-fade-in text-amber-950"
        >
          <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold text-amber-900 font-semibold">⚡ PathPilot Instant Fallback Synthesizer</h4>
            <p className="leading-relaxed mt-1">
              Your roadmap was successfully generated using our offline smart-scheduling fallback engine because the Gemini AI API limits have temporarily been reached. This plan is fully customized based on your time constraints, breaks, and project category! You can retry a live AI query in a few moments.
            </p>
          </div>
        </div>
      )}

      {/* 3. VISUALLY DISTINCT MVO HIGHLIGHTED CARD */}
      <div 
        id="distinct-mvo-card" 
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-md relative overflow-hidden text-white"
      >
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono tracking-wider uppercase bg-slate-800 text-sky-400 border border-slate-700 font-bold">
            🌟 Your Minimum Viable Outcome (MVO)
          </span>

          <div className="flex items-center gap-2">
            {daysLeftBadge && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${daysLeftBadge.color}`}>
                {daysLeftBadge.text}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRiskColor(path.risk_level)}`}>
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {path.risk_level} Risk Assessment
            </span>
          </div>
        </div>

        <div className="space-y-4 max-w-3xl">
          <h2 className="text-xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
            {path.minimum_viable_outcome}
          </h2>
          <p className="text-slate-400 text-xs md:text-sm italic leading-relaxed border-l-2 border-slate-750 pl-3">
            &ldquo;{path.efficiency_quote}&rdquo;
          </p>
        </div>
      </div>

      {/* Celebration Banner when 100% complete */}
      {!focusMode && totalProgress >= 100 && (
        <div 
          id="congratulations-banner" 
          className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl p-5 shadow-sm text-emerald-950 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in"
        >
          <div className="flex items-start gap-3.5">
            <div className="bg-emerald-500 text-white p-2.5 rounded-xl shadow-md shrink-0">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-emerald-900 tracking-tight">Mission Accomplished! 🚀</h3>
              <p className="text-xs text-emerald-800 leading-relaxed mt-1">
                You have systematically executed every single step, cleared your critical must-dos, and smashed through starting resistance! Your Minimum Viable Outcome is fully complete and ready to launch.
              </p>
            </div>
          </div>
          <button
            id="btn-celebrate-success"
            onClick={() => {
              // Reset all checkmarks to let them review or do it again
              setCheckedSteps({});
              setCheckedMustDos({});
              setNextActionDone(false);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shrink-0 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
          >
            Reset Progress
          </button>
        </div>
      )}

      {/* Stats and Progress bar card */}
      {!focusMode && (
        <div id="progress-stats-panel" className="bg-white border border-natural-border rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs font-mono text-natural-text-muted mb-1.5">
                <span>Overall Path Progress</span>
                <span className="font-semibold text-natural-text-dark">{totalProgress}%</span>
              </div>
              <div className="h-2.5 w-full bg-natural-panel rounded-full overflow-hidden">
                <div 
                  className="h-full bg-natural-brand transition-all duration-500 ease-out rounded-full" 
                  style={{ width: `${Math.min(totalProgress, 100)}%` }}
                />
              </div>
            </div>
            <div className="flex gap-4 sm:pl-6 shrink-0">
              <div className="text-center">
                <span className="block text-lg font-bold text-natural-text-dark font-mono">
                  {path.estimated_total_hours}h
                </span>
                <span className="text-[10px] text-natural-text-muted font-mono uppercase tracking-wider">
                  Est. Time
                </span>
              </div>
              <div className="w-[1px] bg-natural-border" />
              <div className="text-center">
                <span className="block text-lg font-bold text-natural-text-dark font-mono">
                  {completedStepsCount}/{totalStepsCount}
                </span>
                <span className="text-[10px] text-natural-text-muted font-mono uppercase tracking-wider">
                  Steps Done
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Procrastination Killer (Immediate Next Action) */}
      {!focusMode && (
        <div 
          id="next-action-card" 
          className={`rounded-xl border p-5 transition-all ${
            nextActionDone 
              ? "bg-natural-panel border-natural-border text-natural-text-muted opacity-85" 
              : "bg-natural-must-bg border-natural-must-border text-natural-must-text shadow-sm"
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg shrink-0 ${nextActionDone ? "bg-natural-border text-natural-text-muted" : "bg-natural-must-accent/10 text-natural-must-accent"}`}>
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className={`block text-[10px] font-mono uppercase tracking-widest mb-0.5 ${nextActionDone ? "text-natural-text-muted" : "text-natural-must-accent"}`}>
                  Immediate Next Action (Procrastination Killer)
                </span>
                <h3 className={`font-semibold text-base leading-snug ${nextActionDone ? "line-through text-natural-text-muted" : "text-natural-text-dark"}`}>
                  {path.next_action}
                </h3>
                <p className="text-xs mt-1 text-natural-text-desc">
                  A sub-3-minute physical trigger designed to shatter resistance and initiate immediate momentum.
                </p>
              </div>
            </div>

            <button
              id="btn-trigger-next-action"
              onClick={() => setNextActionDone(!nextActionDone)}
              className={`w-full md:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                nextActionDone
                  ? "bg-natural-border hover:bg-natural-border/80 text-natural-text-main"
                  : "bg-natural-brand hover:bg-natural-brand-hover text-white font-bold"
              }`}
            >
              {nextActionDone ? (
                <>
                  <Check className="w-4 h-4" />
                  Done! Restart
                </>
              ) : (
                <>
                  I&apos;ve Done This
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Active Step Timer Box (if selected) */}
      {activeTimerStepIndex !== null && activeTimerStepIndex < path.steps.length && (
        <ActiveStepTimer 
          step={path.steps[activeTimerStepIndex]} 
          onComplete={() => {
            toggleStep(activeTimerStepIndex);
            // Auto advance to next step if there is one
            if (activeTimerStepIndex + 1 < path.steps.length) {
              setActiveTimerStepIndex(activeTimerStepIndex + 1);
            } else {
              setActiveTimerStepIndex(null);
            }
          }}
        />
      )}

      {/* Grid: Left Column (Must-Do & Skip), Right Column (Timeline) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (Lists) - takes 5 cols */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* MUST DO CHECKLIST */}
          <div id="must-do-checklist-card" className="bg-white border border-natural-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-natural-border">
              <div>
                <h3 className="font-bold text-sm tracking-tight text-natural-text-dark">
                  Critical Must-Do Focus
                </h3>
                <p className="text-xs text-natural-text-muted">Non-negotiable high-impact items</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-natural-must-bg text-natural-must-text border border-natural-must-border">
                {completedMustDosCount}/{totalMustDosCount} Done
              </span>
            </div>

            <div className="space-y-2.5">
              {path.must_do.map((item, index) => {
                const isChecked = !!checkedMustDos[index];
                return (
                  <button
                    key={index}
                    id={`btn-toggle-mustdo-${index}`}
                    onClick={() => toggleMustDo(index)}
                    role="checkbox"
                    aria-checked={isChecked}
                    className={`w-full flex items-start gap-3 p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      isChecked 
                        ? "bg-natural-panel border-natural-border/60 text-natural-text-muted" 
                        : "bg-white border-natural-border hover:border-natural-text-muted/50 text-natural-text-main"
                    }`}
                  >
                    <span className="shrink-0 mt-0.5">
                      {isChecked ? (
                        <CheckCircle2 className="w-4.5 h-4.5 text-natural-must-accent" />
                      ) : (
                        <Circle className="w-4.5 h-4.5 text-natural-text-muted/65" />
                      )}
                    </span>
                    <span className={`text-xs leading-relaxed ${isChecked ? "line-through" : ""}`}>
                      {item}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SKIP / DESCUTTER GUIDE */}
          <div id="skip-list-card" className="bg-white border border-natural-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-natural-border text-natural-text-muted">
              <Ban className="w-4 h-4 shrink-0 text-natural-skip-accent" />
              <div>
                <h3 className="font-bold text-sm tracking-tight text-natural-text-dark">
                  Ruthless Skip List
                </h3>
                <p className="text-xs text-natural-text-muted">Actively avoid these to stay on time</p>
              </div>
            </div>

            <div className="space-y-2">
              {path.skip.map((item, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg bg-natural-skip-bg border border-natural-skip-border text-natural-skip-text text-xs"
                >
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-natural-skip-border text-[10px] font-mono text-natural-skip-text shrink-0 mt-0.5 font-bold">
                    ✕
                  </span>
                  <span className="leading-relaxed font-medium">
                    {item}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="mt-3.5 pt-3 border-t border-natural-border bg-natural-panel p-2.5 rounded-lg text-[10px] text-natural-text-desc text-center leading-normal">
              Remember: Perfectionism is the enemy of launch. Doing what is necessary and skipping the fluff guarantees delivery.
            </div>
          </div>

        </div>

        {/* Right Column (Timeline) - takes 7 cols */}
        <div className="lg:col-span-7">
          <div id="timeline-card" className="bg-white border border-natural-border rounded-xl p-5 shadow-sm h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-natural-border">
                <div>
                  <h3 className="font-bold text-sm tracking-tight text-natural-text-dark">
                    Chronological Pilot Steps
                  </h3>
                  <p className="text-xs text-natural-text-muted">Step-by-step roadmap to the outcome</p>
                </div>
                <span className="text-[10px] font-mono text-natural-text-muted flex items-center gap-1">
                  <Clock className="w-3 h-3 text-natural-text-muted" />
                  {path.estimated_total_hours} Hours Total
                </span>
              </div>

              <div className="space-y-4 relative mb-6">
                {/* Connecting line helper */}
                <div className="absolute top-2.5 bottom-2.5 left-5 w-[1px] bg-natural-border hidden sm:block" />

                {path.steps.map((step, index) => {
                  const isChecked = !!checkedSteps[index];
                  const isActiveTimer = activeTimerStepIndex === index;

                  return (
                    <div 
                      key={index} 
                      id={`timeline-step-${index}`}
                      className={`relative flex flex-col sm:flex-row items-start gap-3 sm:pl-10 p-3 rounded-xl border transition-all ${
                        isChecked 
                          ? "bg-natural-panel border-natural-border/40 text-natural-text-muted opacity-80" 
                          : isActiveTimer
                            ? "bg-natural-brand border-natural-brand text-white shadow-md scale-[1.01]"
                            : "bg-white border-natural-border hover:border-natural-text-muted/40 text-natural-text-main"
                      }`}
                    >
                      {/* Circle Indicator on timeline (desktop) */}
                      <div className="absolute left-3.5 top-5 w-3.5 h-3.5 rounded-full border-2 border-natural-border bg-white items-center justify-center hidden sm:flex">
                        <div className={`w-1.5 h-1.5 rounded-full ${isChecked ? "bg-natural-text-muted" : "bg-natural-accent animate-pulse"}`} />
                      </div>

                      <div className="flex items-start gap-2.5 w-full">
                        {/* Checkbox */}
                        <button
                          id={`btn-check-step-${index}`}
                          onClick={() => toggleStep(index)}
                          role="checkbox"
                          aria-checked={isChecked}
                          className="shrink-0 mt-0.5 cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckCircle2 className={`w-5 h-5 ${isActiveTimer ? "text-white" : "text-natural-brand"}`} />
                          ) : (
                            <Circle className={`w-5 h-5 ${isActiveTimer ? "text-white/60 hover:text-white" : "text-natural-text-muted/60 hover:text-natural-text-dark"}`} />
                          )}
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className={`font-semibold text-xs leading-snug truncate ${isChecked ? "line-through text-natural-text-muted" : isActiveTimer ? "text-white font-bold" : "text-natural-text-dark font-semibold"}`}>
                              {step.title}
                            </h4>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono ${
                              isActiveTimer 
                                ? "bg-natural-brand-hover text-white border border-white/20" 
                                : isChecked 
                                  ? "bg-natural-border/55 text-natural-text-muted" 
                                  : "bg-natural-panel text-natural-text-main border border-natural-border"
                            }`}>
                              {step.estimated_minutes}m
                            </span>
                          </div>
                          <p className={`text-[11px] leading-relaxed mt-1 ${isChecked ? "text-natural-text-muted" : isActiveTimer ? "text-white/80" : "text-natural-text-desc"}`}>
                            {step.description}
                          </p>
                        </div>

                        {/* Timer Launcher Button */}
                        {!isChecked && (
                          <button
                            id={`btn-launch-timer-${index}`}
                            onClick={() => {
                              if (isActiveTimer) {
                                setActiveTimerStepIndex(null);
                              } else {
                                setActiveTimerStepIndex(index);
                              }
                            }}
                            className={`p-1.5 rounded-lg border shrink-0 cursor-pointer transition-all ${
                              isActiveTimer
                                ? "bg-white/10 border-white/20 text-white hover:bg-white/20"
                                : "border-natural-border text-natural-text-muted hover:bg-natural-panel hover:text-natural-text-dark"
                            }`}
                            title={isActiveTimer ? "Close Timer" : "Start Focus Timer"}
                          >
                            <Play className={`w-3.5 h-3.5 ${isActiveTimer ? "fill-white" : ""}`} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Google Calendar export quick action button */}
            {!focusMode && (
              <div className="pt-3 border-t border-natural-border">
                <button
                  id="btn-export-calendar-bottom"
                  onClick={handleExportToGoogleCalendar}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-natural-brand/20 bg-natural-brand/5 text-natural-brand hover:bg-natural-brand text-xs font-bold hover:text-white transition-all cursor-pointer shadow-sm"
                >
                  <Calendar className="w-4 h-4" />
                  📅 Add all tasks to Google Calendar
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 5. START RIGHT NOW ACTION BLOCK */}
      {!focusMode && (
        <div 
          id="start-right-now-card" 
          className="bg-blue-50 border border-blue-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase bg-blue-100 text-blue-800 border border-blue-200 font-semibold">
              Sprint Strategy
            </span>
            <h3 className="font-extrabold text-lg text-slate-950 tracking-tight leading-tight">
              START RIGHT NOW &mdash; Beat Procrastination
            </h3>
            <p className="text-slate-600 text-xs max-w-xl leading-relaxed">
              Action precedes motivation. Do not think. Do not hesitate. Click the countdown below to trigger a highly intense, 5-minute focused burst on your first next action.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 w-full md:w-auto">
            {/* Countdown timer circular/box display */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 text-center min-w-[110px] shadow-sm">
              <span className="block text-2xl font-extrabold text-white font-mono tracking-widest">
                {formatSprintTime(sprintSeconds)}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono">
                {sprintRunning ? "In Progress" : sprintDone ? "Completed!" : "Sprint Timer"}
              </span>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                id="btn-toggle-sprint"
                onClick={handleToggleSprint}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all ${
                  sprintRunning
                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : sprintDone
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                {sprintRunning ? "Pause" : sprintDone ? "Reset & Restart" : "Start 5-Min Sprint"}
              </button>
              {(sprintRunning || sprintSeconds < 300) && !sprintDone && (
                <button
                  id="btn-reset-sprint"
                  onClick={handleResetSprint}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3.5 py-3 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                  title="Reset Sprint"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
