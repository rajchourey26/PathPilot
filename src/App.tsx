import { useState, useEffect, FormEvent } from "react";
import { 
  Compass, 
  Sparkles, 
  Clock, 
  History, 
  ChevronRight, 
  AlertCircle, 
  ArrowRight,
  BookOpen,
  X,
  Plus,
  RefreshCw,
  Check
} from "lucide-react";
import { PathResponse, SavedPath } from "./types";
import PathDashboard from "./components/PathDashboard";
import SavedPathsList from "./components/SavedPathsList";

const QUICK_TEMPLATES = [
  {
    label: "Quarterly presentation",
    prompt: "Prepare and practice a 10-slide quarterly engineering metrics presentation. Highlight major shipping velocities and backend performance improvements.",
    hours: 3
  },
  {
    label: "Stripe checkout page",
    prompt: "Integrate a clean Stripe checkout button into our landing page, test with sandbox keys, and deploy live purchases.",
    hours: 4
  },
  {
    label: "Launch product launch post",
    prompt: "Write a high-converting Product Hunt launch description, coordinate 3 social graphics on Figma, and draft a launch newsletter.",
    hours: 2
  }
];

const LOADING_STEPS = [
  "Analyzing task parameters...",
  "Running extreme-efficiency algorithms...",
  "Pruning non-essential scope...",
  "Defining the Minimum Viable Outcome...",
  "Formatting immediate momentum triggers...",
  "Securing chronological roadmap steps..."
];

export default function App() {
  const [task, setTask] = useState("");
  const [availableHours, setAvailableHours] = useState<string>("");
  const [deadlineDate, setDeadlineDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const [activePath, setActivePath] = useState<PathResponse | null>(null);
  const [savedPaths, setSavedPaths] = useState<SavedPath[]>([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [apiHealth, setApiHealth] = useState<"optimal" | "degraded" | "offline">("optimal");
  const [focusMode, setFocusMode] = useState(false);

  // Core Deadline Rescue Planner Tab and Form States
  const [activeTab, setActiveTab] = useState<"roadmap" | "rescue">("roadmap");
  const [rescueTitle, setRescueTitle] = useState("");
  const [rescueDescription, setRescueDescription] = useState("");
  const [rescueDeadline, setRescueDeadline] = useState("");
  const [rescueHours, setRescueHours] = useState("");
  const [rescuePriority, setRescuePriority] = useState<"Low" | "Medium" | "High" | "Critical">("High");
  const [rescueFeedback, setRescueFeedback] = useState<{
    success: boolean;
    message: string;
    payload?: any;
  } | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("pathpilot_saved_paths");
      if (stored) {
        setSavedPaths(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Error reading localStorage", e);
    }
  }, []);

  // Monitor planning engine health status
  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      const startTime = performance.now();
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const endTime = performance.now();
        if (!active) return;
        if (res.ok) {
          const latency = endTime - startTime;
          // Deem degraded if latency is exceptionally high, otherwise optimal
          if (latency > 650) {
            setApiHealth("degraded");
          } else {
            setApiHealth("optimal");
          }
        } else {
          setApiHealth("degraded");
        }
      } catch (err) {
        if (active) {
          setApiHealth("offline");
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 25000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Loading steps animation sequencer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 2200);
    } else {
      setLoadingStepIndex(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  const saveToHistory = (pathResult: PathResponse, originalTask: string, hours: number | null, deadlineVal?: string | null) => {
    try {
      const newSaved: SavedPath = {
        id: Math.random().toString(36).substring(2, 11),
        createdAt: new Date().toISOString(),
        task: originalTask,
        availableHours: hours,
        deadlineDate: deadlineVal || null,
        response: pathResult
      };

      const updated = [newSaved, ...savedPaths];
      setSavedPaths(updated);
      localStorage.setItem("pathpilot_saved_paths", JSON.stringify(updated));
      setCurrentSavedId(newSaved.id);
    } catch (e) {
      console.error("Error saving path to localStorage", e);
    }
  };

  const deleteFromHistory = (id: string) => {
    try {
      const updated = savedPaths.filter((p) => p.id !== id);
      setSavedPaths(updated);
      localStorage.setItem("pathpilot_saved_paths", JSON.stringify(updated));
      if (currentSavedId === id) {
        setCurrentSavedId(null);
      }
    } catch (e) {
      console.error("Error deleting path from localStorage", e);
    }
  };

  const handleSelectSaved = (saved: SavedPath) => {
    setActivePath(saved.response);
    setTask(saved.task);
    setAvailableHours(saved.availableHours ? saved.availableHours.toString() : "");
    setDeadlineDate(saved.deadlineDate || "");
    setCurrentSavedId(saved.id);
    setError(null);
    setValidationError(null);
    
    // On mobile & tablet screens, close history after selection to focus on the main view
    if (window.innerWidth < 1024) {
      setShowHistorySidebar(false);
    }

    // Scroll back to the top where the dashboard is rendered
    window.scrollTo({ top: 0, behavior: "smooth" });
    
    // Smooth scroll to loaded path dashboard wrapper specifically
    setTimeout(() => {
      const el = document.getElementById("path-dashboard-wrapper");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const executeGeneration = async (taskText: string, hoursText: string, deadlineText: string) => {
    setLoading(true);
    setError(null);
    setValidationError(null);
    setActivePath(null);
    setCurrentSavedId(null);
    setStreamedText("");

    const hoursNum = hoursText ? parseFloat(hoursText) : null;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: taskText.trim(),
          availableHours: hoursNum,
          deadlineDate: deadlineText || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Streaming is not supported by this browser.");
      }

      const decoder = new TextDecoder("utf-8");
      let done = false;
      let accumulated = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          accumulated += chunk;
          setStreamedText(accumulated);
        }
      }

      let parsedData: any;
      try {
        parsedData = JSON.parse(accumulated.trim());
      } catch (parseErr) {
        console.error("Failed to parse JSON stream", parseErr, accumulated);
        if (accumulated.includes('"error"')) {
          try {
            const errorObj = JSON.parse(accumulated.trim());
            throw new Error(errorObj.error || "An error occurred during tactical planning stream.");
          } catch (e) {
            throw new Error("An error occurred during tactical planning stream.");
          }
        }
        throw new Error("Received invalid or incomplete response from PathPilot engine. Please try again.");
      }

      if (parsedData && typeof parsedData === "object" && "error" in parsedData) {
        throw new Error(parsedData.error || "An error occurred during tactical planning stream.");
      }

      setActivePath(parsedData);
      saveToHistory(parsedData, taskText.trim(), hoursNum, deadlineText || null);

    } catch (err: any) {
      console.error("Fetch error", err);
      setError(err.message || "An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!task.trim()) {
      setValidationError("Please describe your goal before generating.");
      return;
    }
    setValidationError(null);
    await executeGeneration(task, availableHours, deadlineDate);
  };

  const loadTemplate = async (tmpl: typeof QUICK_TEMPLATES[0]) => {
    setTask(tmpl.prompt);
    setAvailableHours(tmpl.hours.toString());
    setDeadlineDate("");
    setError(null);
    setValidationError(null);
    await executeGeneration(tmpl.prompt, tmpl.hours.toString(), "");
  };

  const startNewPath = () => {
    setActivePath(null);
    setTask("");
    setAvailableHours("");
    setDeadlineDate("");
    setCurrentSavedId(null);
    setError(null);
    setValidationError(null);
    setFocusMode(false);
    
    // Clear rescue planner inputs
    setRescueTitle("");
    setRescueDescription("");
    setRescueDeadline("");
    setRescueHours("");
    setRescuePriority("High");
    setRescueFeedback(null);
  };

  const handleGenerateRescuePlan = async (e: FormEvent) => {
    e.preventDefault();
    if (!rescueTitle.trim()) {
      setValidationError("Please enter a Task Title.");
      return;
    }
    if (!rescueDescription.trim()) {
      setValidationError("Please provide a brief Task Description.");
      return;
    }
    if (!rescueDeadline) {
      setValidationError("Please specify a valid Deadline date & time.");
      return;
    }
    if (!rescueHours || parseFloat(rescueHours) <= 0) {
      setValidationError("Please input positive Available Hours for implementation.");
      return;
    }
    
    setValidationError(null);
    
    const fullTaskDescription = `[RESCUE PLAN - PRIORITY: ${rescuePriority}] Title: ${rescueTitle.trim()}\nContext: ${rescueDescription.trim()}`;
    
    setTask(rescueTitle.trim());
    setAvailableHours(rescueHours);
    setDeadlineDate(rescueDeadline);
    
    await executeGeneration(fullTaskDescription, rescueHours, rescueDeadline);
  };

  const isCurrentActiveSaved = savedPaths.some((p) => p.id === currentSavedId);

  return (
    <div className="min-h-screen bg-natural-bg text-natural-text-main font-sans antialiased flex flex-col">
      
      {/* HEADER */}
      {!focusMode && (
        <header id="main-header" className="bg-white border-b border-natural-border py-3.5 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              id="logo-button"
              onClick={startNewPath}
              className="flex items-center gap-2 group text-left cursor-pointer"
            >
              <div className="bg-natural-brand text-white p-2 rounded-xl transition-all duration-500 group-hover:scale-105 group-hover:bg-natural-accent">
                <Compass className="w-5 h-5 text-white transition-all duration-500" />
              </div>
              <div>
                <h1 className="font-bold text-base md:text-lg tracking-tight text-natural-text-dark flex items-center gap-1.5">
                  PathPilot
                  <span className="text-[10px] bg-natural-panel border border-natural-border text-natural-text-main px-1.5 py-0.5 rounded-full font-normal tracking-wide font-mono">v1.1</span>
                </h1>
                <p className="text-[10px] text-natural-text-muted font-mono hidden sm:block">Systematic Implementation & Roadmap Architecture</p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* API Health Connection Badge */}
            <div 
              id="api-health-badge"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-mono font-bold tracking-wide transition-all duration-350 ${
                apiHealth === "optimal"
                  ? "bg-emerald-50/70 border-emerald-100 text-emerald-700"
                  : apiHealth === "degraded"
                    ? "bg-amber-50/70 border-amber-100 text-amber-700"
                    : "bg-rose-50/70 border-rose-100 text-rose-750"
              }`}
              title="API connection health to the planning engine"
            >
              <span className="relative flex h-1.5 w-1.5">
                {apiHealth === "optimal" && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                {apiHealth === "degraded" && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                  apiHealth === "optimal" 
                    ? "bg-emerald-500" 
                    : apiHealth === "degraded" 
                      ? "bg-amber-500 animate-pulse" 
                      : "bg-rose-500"
                }`}></span>
              </span>
              <span className="hidden xs:inline text-[9px] uppercase tracking-wider opacity-60 font-bold">Engine:</span>
              <span className="uppercase tracking-wider text-[9px]">{apiHealth}</span>
            </div>

            {/* Active stats */}
            <button
              id="btn-toggle-history-sidebar"
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                showHistorySidebar 
                  ? "bg-natural-brand border-natural-brand text-white" 
                  : "bg-natural-panel hover:bg-natural-border/30 border-natural-border text-natural-text-main"
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span>History</span>
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-mono leading-none ${
                showHistorySidebar ? "bg-natural-brand-hover text-white" : "bg-natural-border text-natural-text-main"
              }`}>
                {savedPaths.length}
              </span>
            </button>

            {activePath && (
              <button
                id="btn-start-new-path-header"
                onClick={startNewPath}
                className="hidden sm:flex items-center gap-1 bg-natural-brand hover:bg-natural-brand-hover text-white text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" />
                New Path
              </button>
            )}
          </div>
        </header>
      )}

      {/* MAIN CONTAINER */}
      <div className={`flex-1 w-full mx-auto p-4 md:p-6 lg:p-8 relative ${focusMode ? "max-w-4xl" : "max-w-7xl grid grid-cols-1 md:grid-cols-12 gap-6"}`}>
        
        {/* LEFT / CENTRAL FORM AREA (takes full space if no activePath, or splits) */}
        <main className={`space-y-6 transition-all duration-300 ${focusMode ? "w-full" : (activePath ? "md:col-span-12 lg:col-span-9" : "md:col-span-12 lg:col-span-8 lg:col-start-3")}`}>
          
          {error && (
            <div id="error-banner" className="bg-natural-skip-bg border border-natural-skip-border text-natural-skip-text p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-natural-skip-accent shrink-0 mt-0.5" />
              <div className="text-xs">
                <h4 className="font-bold mb-1">Generation Failed</h4>
                <p className="leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* GENERATOR CARD (collapses slightly if path generated to keep focus, but always visible) */}
          {!activePath && !loading ? (
            <div id="generator-onboarding" className="space-y-6">
              
              <div className="text-center py-6 max-w-xl mx-auto">
                <span className="inline-flex items-center gap-1 bg-natural-brand/10 text-natural-brand text-xs px-2.5 py-1 rounded-full font-medium mb-3">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  Optimize Implementation Efficiency & Mitigate Scope Expansion
                </span>
                <h2 className="text-3xl font-extrabold text-natural-text-dark tracking-tight leading-none sm:text-4xl">
                  De-risk your goals. Launch with speed.
                </h2>
                <p className="text-natural-text-desc text-sm mt-3 leading-relaxed">
                  Submit any complex initiative, impending deadline, or comprehensive checklist. The system will define the **Minimum Viable Outcome**, formulate a rigorous and realistic roadmap, and catalyze your immediate execution.
                </p>
              </div>

              {/* Quick Onboarding Templates */}
              <div id="quick-templates-box" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {QUICK_TEMPLATES.map((tmpl, i) => (
                  <button
                    key={i}
                    id={`btn-load-template-${i}`}
                    onClick={() => loadTemplate(tmpl)}
                    className="bg-white border border-natural-border rounded-xl p-4 text-left hover:bg-natural-panel hover:border-natural-text-muted/40 cursor-pointer transition-all flex flex-col justify-between group h-full shadow-sm"
                  >
                    <div>
                      <span className="text-[9px] font-mono font-medium uppercase tracking-wider text-natural-text-muted block mb-2">
                        Template Option {i + 1}
                      </span>
                      <h4 className="font-bold text-xs text-natural-text-dark group-hover:text-natural-brand transition-colors">
                        {tmpl.label}
                      </h4>
                      <p className="text-[11px] text-natural-text-desc mt-1 line-clamp-2 leading-relaxed">
                        {tmpl.prompt}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-2 border-t border-natural-border w-full text-[10px] text-natural-text-muted font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-natural-text-muted" />
                        {tmpl.hours}h limit
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-natural-text-muted/70 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>

            </div>
          ) : null}

          {/* INPUT FORM (Visible on first screen or when editing active path, or while loading) */}
          {(!activePath || loading) && (
            <div id="generator-form-card" className={`bg-white border border-natural-border rounded-2xl p-5 md:p-6 shadow-sm transition-opacity duration-300 ${loading ? "opacity-75 pointer-events-none" : ""}`}>
              
              {/* Tab Selector Section */}
              <div className="flex border-b border-natural-border pb-4 mb-5 gap-2">
                <button
                  type="button"
                  id="tab-roadmap"
                  onClick={() => { setActiveTab("roadmap"); setValidationError(null); }}
                  className={`flex-1 py-2.5 px-3 text-center text-xs font-bold uppercase tracking-wider transition-all rounded-xl cursor-pointer flex items-center justify-center gap-2 ${
                    activeTab === "roadmap"
                      ? "bg-natural-brand text-white shadow-sm font-extrabold"
                      : "text-natural-text-muted hover:text-natural-text-dark hover:bg-natural-panel"
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  Roadmap Builder
                </button>
                <button
                  type="button"
                  id="tab-rescue"
                  onClick={() => { setActiveTab("rescue"); setValidationError(null); }}
                  className={`flex-1 py-2.5 px-3 text-center text-xs font-bold uppercase tracking-wider transition-all rounded-xl cursor-pointer flex items-center justify-center gap-2 ${
                    activeTab === "rescue"
                      ? "bg-natural-brand text-white shadow-sm font-extrabold"
                      : "text-natural-text-muted hover:text-natural-text-dark hover:bg-natural-panel"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                  Deadline Rescue Planner
                </button>
              </div>

              {activeTab === "roadmap" ? (
                <form onSubmit={handleGenerate} className="space-y-4">
                  
                  <div>
                    <label htmlFor="task-input" className="block text-xs font-bold text-natural-text-muted uppercase tracking-wider font-mono mb-1.5">
                      1. Describe the goal or looming deadline
                    </label>
                    <textarea
                      id="task-input"
                      value={task}
                      onChange={(e) => {
                        setTask(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      disabled={loading}
                      rows={4}
                      placeholder="e.g. I need to complete our launch presentation deck for investors. I have 15 slide drafts but they are totally unstructured, the visuals are messy, and I don't know where to start."
                      className="w-full rounded-xl border border-natural-border bg-natural-panel p-4 text-sm text-natural-text-dark placeholder:text-natural-text-muted focus:border-natural-brand focus:bg-white focus:outline-none transition-all resize-y"
                    />
                    {validationError && (
                      <p id="validation-error" className="text-red-500 text-xs mt-1.5 font-medium">
                        {validationError}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="hours-input" className="block text-xs font-bold text-natural-text-muted uppercase tracking-wider font-mono mb-1.5">
                        2. Available hours <span className="text-natural-text-muted font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <input
                          id="hours-input"
                          type="number"
                          min="0.5"
                          max="168"
                          step="0.5"
                          value={availableHours}
                          onChange={(e) => {
                            setAvailableHours(e.target.value);
                            if (validationError) setValidationError(null);
                          }}
                          disabled={loading}
                          placeholder="e.g. 4"
                          className="w-full rounded-xl border border-natural-border bg-natural-panel pl-4 pr-12 py-3 text-sm text-natural-text-dark placeholder:text-natural-text-muted focus:border-natural-brand focus:bg-white focus:outline-none transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-natural-text-muted">
                          hours
                        </span>
                      </div>
                      <span className="block text-[10px] text-natural-text-desc font-mono mt-1 leading-normal">
                        Leave blank to calculate an ideal unconstrained timeline.
                      </span>
                    </div>

                    <div>
                      <label htmlFor="deadline-input" className="block text-xs font-bold text-natural-text-muted uppercase tracking-wider font-mono mb-1.5">
                        3. Deadline <span className="text-natural-text-muted font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <input
                          id="deadline-input"
                          type="date"
                          value={deadlineDate}
                          onChange={(e) => {
                            setDeadlineDate(e.target.value);
                            if (validationError) setValidationError(null);
                          }}
                          disabled={loading}
                          className="w-full rounded-xl border border-natural-border bg-natural-panel px-4 py-3 text-sm text-natural-text-dark focus:border-natural-brand focus:bg-white focus:outline-none transition-all"
                        />
                      </div>
                      <span className="block text-[10px] text-natural-text-desc font-mono mt-1 leading-normal">
                        Calculate backward scheduling to stay on track.
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col pt-2">
                    <button
                      id="btn-generate-path"
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-natural-brand hover:bg-natural-brand-hover text-white disabled:bg-natural-panel disabled:text-natural-text-muted py-3 px-6 rounded-xl text-sm font-bold transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 text-white animate-spin" />
                          Building your plan...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-white/85" />
                          Build My Plan →
                        </>
                      )}
                    </button>
                  </div>

                </form>
              ) : (
                <form onSubmit={handleGenerateRescuePlan} className="space-y-5">
                  <div className="border-l-4 border-rose-500 pl-3 py-1 bg-rose-500/5 rounded-r-xl">
                    <h3 className="font-extrabold text-sm text-natural-text-dark">Deadline Rescue Planner</h3>
                    <p className="text-[11px] text-natural-text-desc font-mono">High-intensity triage for critical objectives with fast approaching deadlines.</p>
                  </div>

                  {rescueFeedback && (
                    <div id="rescue-feedback-banner" className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-5 rounded-2xl space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-emerald-100 p-1.5 rounded-lg text-emerald-700 shrink-0">
                          <Check className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-emerald-900">{rescueFeedback.message}</h4>
                          <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                            Your rescue parameters have been parsed and validated by the **Deadline Rescue Planner** frontend interface.
                          </p>
                        </div>
                      </div>

                      <div className="bg-white border border-emerald-100 rounded-xl p-4 space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-2.5">
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono uppercase">Priority Level</span>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase mt-1 ${
                              rescueFeedback.payload.priority === "Critical" ? "bg-rose-100 text-rose-800 border border-rose-200" :
                              rescueFeedback.payload.priority === "High" ? "bg-indigo-100 text-indigo-800 border border-indigo-200" :
                              rescueFeedback.payload.priority === "Medium" ? "bg-sky-100 text-sky-800 border border-sky-200" :
                              "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}>
                              {rescueFeedback.payload.priority}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono uppercase">Timeline Budget</span>
                            <span className="font-semibold text-slate-800 mt-1 block">
                              {rescueFeedback.payload.hours} Hours Available
                            </span>
                          </div>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 font-mono uppercase">Task Title</span>
                          <span className="font-bold text-slate-900 text-sm mt-0.5 block">{rescueFeedback.payload.title}</span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 font-mono uppercase">Task Description</span>
                          <p className="text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap">{rescueFeedback.payload.description}</p>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 font-mono uppercase">Target Deadline</span>
                          <span className="font-mono font-semibold text-slate-700 mt-1 block">
                            {new Date(rescueFeedback.payload.deadline).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setRescueFeedback(null)}
                          className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
                        >
                          Modify Parameters
                        </button>
                      </div>
                    </div>
                  )}

                  {!rescueFeedback && (
                    <>
                      <div>
                        <label htmlFor="rescue-title" className="block text-xs font-bold text-natural-text-muted uppercase tracking-wider font-mono mb-1.5">
                          Task Title
                        </label>
                        <input
                          id="rescue-title"
                          type="text"
                          value={rescueTitle}
                          onChange={(e) => {
                            setRescueTitle(e.target.value);
                            if (validationError) setValidationError(null);
                          }}
                          placeholder="e.g. Redesign Landing Page Checkout Flow"
                          className="w-full rounded-xl border border-natural-border bg-natural-panel p-3 text-sm text-natural-text-dark placeholder:text-natural-text-muted focus:border-natural-brand focus:bg-white focus:outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label htmlFor="rescue-desc" className="block text-xs font-bold text-natural-text-muted uppercase tracking-wider font-mono mb-1.5">
                          Task Description
                        </label>
                        <textarea
                          id="rescue-desc"
                          rows={3}
                          value={rescueDescription}
                          onChange={(e) => {
                            setRescueDescription(e.target.value);
                            if (validationError) setValidationError(null);
                          }}
                          placeholder="Provide context, constraints, and specific goals to help the planner identify low-value tasks to prune."
                          className="w-full rounded-xl border border-natural-border bg-natural-panel p-3 text-sm text-natural-text-dark placeholder:text-natural-text-muted focus:border-natural-brand focus:bg-white focus:outline-none transition-all resize-y"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="rescue-deadline" className="block text-xs font-bold text-natural-text-muted uppercase tracking-wider font-mono mb-1.5">
                            Deadline (date & time)
                          </label>
                          <input
                            id="rescue-deadline"
                            type="datetime-local"
                            value={rescueDeadline}
                            onChange={(e) => {
                              setRescueDeadline(e.target.value);
                              if (validationError) setValidationError(null);
                            }}
                            className="w-full rounded-xl border border-natural-border bg-natural-panel px-4 py-3 text-sm text-natural-text-dark focus:border-natural-brand focus:bg-white focus:outline-none transition-all"
                          />
                        </div>

                        <div>
                          <label htmlFor="rescue-hours" className="block text-xs font-bold text-natural-text-muted uppercase tracking-wider font-mono mb-1.5">
                            Available Hours
                          </label>
                          <input
                            id="rescue-hours"
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={rescueHours}
                            onChange={(e) => {
                              setRescueHours(e.target.value);
                              if (validationError) setValidationError(null);
                            }}
                            placeholder="e.g. 5.5"
                            className="w-full rounded-xl border border-natural-border bg-natural-panel px-4 py-3 text-sm text-natural-text-dark placeholder:text-natural-text-muted focus:border-natural-brand focus:bg-white focus:outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-natural-text-muted uppercase tracking-wider font-mono mb-2">
                          Priority Level
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {(["Low", "Medium", "High", "Critical"] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setRescuePriority(p)}
                              className={`py-2 px-3 text-center text-xs font-extrabold uppercase tracking-wider transition-all rounded-xl border cursor-pointer ${
                                rescuePriority === p
                                  ? (p === "Critical" ? "bg-rose-600 border-rose-600 text-white shadow-sm font-extrabold" :
                                     p === "High" ? "bg-indigo-600 border-indigo-600 text-white shadow-sm font-extrabold" :
                                     p === "Medium" ? "bg-sky-600 border-sky-600 text-white shadow-sm font-extrabold" :
                                     "bg-slate-700 border-slate-700 text-white shadow-sm font-extrabold")
                                  : "bg-white border-natural-border text-natural-text-desc hover:bg-natural-panel"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {validationError && (
                        <p className="text-red-500 text-xs mt-1 font-medium font-mono bg-red-50 border border-red-100 p-2.5 rounded-xl flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {validationError}
                        </p>
                      )}

                      <div className="pt-2">
                        <button
                          id="btn-generate-rescue-plan"
                          type="submit"
                          className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white py-3.5 px-6 rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all shadow-md cursor-pointer hover:shadow-lg hover:scale-[1.01]"
                        >
                          <Sparkles className="w-4 h-4 text-white/90 animate-pulse" />
                          Generate AI Rescue Plan
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}
            </div>
          )}

          {/* Back button row (when activePath exists and not loading) */}
          {activePath && !loading && !focusMode && (
            <div className="flex items-center justify-between bg-white border border-natural-border rounded-xl p-3 px-4 shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  id="btn-back-to-input"
                  onClick={startNewPath}
                  className="text-natural-text-muted hover:text-natural-text-dark text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                >
                  &larr; Start New Path
                </button>
                <div className="h-4 w-[1px] bg-natural-border" />
                <span className="text-xs text-natural-text-desc truncate max-w-sm md:max-w-md">
                  Active Goal: &ldquo;{task}&rdquo;
                </span>
              </div>
              
              <button
                id="btn-edit-active-goal"
                onClick={() => {
                  setActivePath(null);
                  setError(null);
                }}
                className="text-natural-brand hover:text-natural-brand-hover text-xs font-semibold underline decoration-dotted decoration-natural-brand/50 underline-offset-4 cursor-pointer"
              >
                Modify Request
              </button>
            </div>
          )}

          {/* DETAILED PATH DASHBOARD */}
          {activePath && (
            <PathDashboard 
              path={activePath} 
              onSave={() => isCurrentActiveSaved ? null : saveToHistory(activePath, task, availableHours ? parseFloat(availableHours) : null, deadlineDate || null)}
              isSaved={isCurrentActiveSaved}
              availableHours={availableHours ? parseFloat(availableHours) : null}
              deadlineDate={deadlineDate || null}
              focusMode={focusMode}
              setFocusMode={setFocusMode}
            />
          )}

          {/* DYNAMIC STREAMING & SKELETON LOADING STATE */}
          {loading && (
            <div id="loading-container" className="bg-white border border-natural-border rounded-2xl p-8 text-center space-y-6 shadow-sm">
              <div className="flex flex-col items-center">
                {/* Custom modern spinner */}
                <div className="relative h-12 w-12 flex items-center justify-center mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-natural-panel" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-natural-brand border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                  <Compass className="w-5 h-5 text-natural-brand animate-pulse" />
                </div>
                
                <h3 className="font-extrabold text-natural-text-dark text-lg leading-tight">
                  {activeTab === "rescue" ? "Emergency Rescue Planner is triaging your goal..." : "PathPilot is plotting your course..."}
                </h3>
                <p className="text-natural-text-desc text-xs mt-1.5 font-mono max-w-md">
                  {activeTab === "rescue"
                    ? `Activating high-intensity emergency scheduling for "${rescueTitle || task}".`
                    : "We are parsing your deadline parameters and building a ruthlessly minimal launch path."}
                </p>
              </div>

              {/* Progress step visualizer */}
              <div className="max-w-md mx-auto bg-natural-panel p-4 rounded-xl border border-natural-border flex items-center gap-3">
                <RefreshCw className="w-4 h-4 text-natural-brand animate-spin shrink-0" />
                <span className="text-xs text-natural-text-main font-medium font-mono text-left block">
                  {LOADING_STEPS[loadingStepIndex]}
                </span>
              </div>

              {/* Streaming Output Preview Panel */}
              <div id="streaming-preview" className="bg-slate-900 text-slate-300 border border-slate-800 rounded-xl p-5 font-mono text-xs space-y-3 shadow-md max-w-xl mx-auto text-left relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping absolute" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 relative" />
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400">Tactical Stream Active</span>
                  </div>
                  <span className="text-[9px] text-slate-500">word-by-word pilot plan</span>
                </div>
                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed text-slate-300 text-[11px] font-mono scrollbar-thin scrollbar-thumb-slate-800 select-all">
                  {streamedText || "Connecting to Gemini 3.5 Flash pilot engine..."}
                </div>
              </div>

              {/* Simulated visual skeletons */}
              <div className="space-y-3 pt-4 max-w-lg mx-auto">
                <div className="h-3 bg-natural-border/60 rounded-full w-3/4 animate-pulse mx-auto" />
                <div className="h-2.5 bg-natural-border/60 rounded-full w-1/2 animate-pulse mx-auto" />
              </div>
            </div>
          )}

        </main>

        {/* RIGHT SIDEBAR / HISTORY LIST PANEL (Toggles visible or can always stay open on large screens) */}
        {!focusMode && showHistorySidebar && (
          <aside 
            id="history-sidebar" 
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-natural-panel border-l border-natural-border shadow-2xl p-6 flex flex-col lg:relative lg:inset-auto lg:z-0 lg:col-span-3 lg:shadow-none lg:p-0 lg:border-0 lg:flex"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-natural-border shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-4.5 h-4.5 text-natural-brand" />
                <h3 className="font-bold text-sm text-natural-text-dark">PathPilot History</h3>
              </div>
              <button
                id="btn-close-history-sidebar"
                onClick={() => setShowHistorySidebar(false)}
                className="p-1.5 rounded-lg hover:bg-natural-border/30 text-natural-text-muted hover:text-natural-text-dark cursor-pointer lg:hidden"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <p className="text-xs text-natural-text-desc mb-4 leading-normal">
              Previously designed tactical pathways. Select any path to load its checklist and active focus mode.
            </p>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              <SavedPathsList 
                savedPaths={savedPaths} 
                onSelectPath={handleSelectSaved} 
                onDeletePath={deleteFromHistory}
                activePathId={currentSavedId || undefined}
              />

              {savedPaths.length > 0 && (
                <button
                  id="btn-clear-all-history"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to clear your entire planning history? This cannot be undone.")) {
                      setSavedPaths([]);
                      localStorage.removeItem("pathpilot_saved_paths");
                      setCurrentSavedId(null);
                      setActivePath(null);
                    }
                  }}
                  className="w-full mt-3.5 flex items-center justify-center gap-1.5 py-2 px-3 border border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-colors"
                >
                  🗑️ Clear Entire History
                </button>
              )}
            </div>

            {/* Quick action info */}
            <div className="mt-6 pt-4 border-t border-natural-border shrink-0 text-[10px] text-natural-text-desc leading-relaxed bg-white p-3 rounded-lg">
              Paths are stored securely in your browser&apos;s local cache. Clearing cache will wipe history.
            </div>
          </aside>
        )}

      </div>

      {/* FOOTER */}
      <footer id="main-footer" className="bg-natural-panel border-t border-natural-border py-6 mt-auto px-4 md:px-8 text-center text-xs text-natural-text-muted">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-mono text-[10px]">PathPilot &copy; 2026 &mdash; Built with Google Gemini</span>
          <div className="flex gap-4">
            <span className="text-[10px]">No unrequested telemetry or trackers.</span>
            <span className="text-[10px]">•</span>
            <span className="text-[10px]">100% Client-Side Persistence.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
