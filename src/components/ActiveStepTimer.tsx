import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { PathStep } from "../types";

interface ActiveStepTimerProps {
  step: PathStep;
  onComplete: () => void;
}

export default function ActiveStepTimer({ step, onComplete }: ActiveStepTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(step.estimated_minutes * 60);
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Track step changes to reset the timer
  useEffect(() => {
    setSecondsLeft(step.estimated_minutes * 60);
    setIsActive(false);
    setIsCompleted(false);
  }, [step]);

  // Update browser tab document title with timer countdown
  useEffect(() => {
    if (isActive && secondsLeft > 0) {
      const mins = Math.floor(secondsLeft / 60);
      const secs = secondsLeft % 60;
      const formatted = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      document.title = `[${formatted}] Focus on "${step.title}" | PathPilot`;
    } else if (isCompleted) {
      document.title = "⏰ Timer Finished! | PathPilot";
    } else {
      document.title = "PathPilot";
    }

    // Reset title back to default when component unmounts or step changes
    return () => {
      document.title = "PathPilot";
    };
  }, [isActive, secondsLeft, isCompleted, step.title]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (secondsLeft === 0 && !isCompleted) {
      setIsActive(false);
      setIsCompleted(true);
      // Play a soft beep sound using browser Web Audio API if available
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      } catch (e) {
        // Safe fallback if AudioContext is blocked or unsupported
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, secondsLeft, isCompleted]);

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setSecondsLeft(step.estimated_minutes * 60);
    setIsCompleted(false);
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercentage = 100 - (secondsLeft / (step.estimated_minutes * 60)) * 100;

  return (
    <div id="active-step-timer-card" className="bg-[#1E293B] border border-[#334155] rounded-xl p-5 text-white shadow-lg relative overflow-hidden transition-all">
      {/* Progress background glow */}
      <div 
        className="absolute bottom-0 left-0 h-1 bg-natural-accent transition-all duration-300"
        style={{ width: `${progressPercentage}%` }}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase bg-natural-accent/10 text-natural-accent border border-natural-accent/20 mb-2">
            Focus Mode Active
          </span>
          <h3 className="font-semibold text-lg leading-tight text-white line-clamp-1">
            {step.title}
          </h3>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
            {step.description}
          </p>
        </div>

        <div className="flex items-center gap-4 self-center md:self-auto shrink-0 bg-black/20 px-4 py-2.5 rounded-lg border border-[#334155]">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-mono font-medium tracking-tight w-20 text-center text-slate-100">
              {formatTime(secondsLeft)}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {step.estimated_minutes} min est.
            </span>
          </div>

          <div className="h-8 w-[1px] bg-[#334155]" />

          <div className="flex items-center gap-2">
            {isCompleted ? (
              <button
                id="btn-timer-complete"
                onClick={onComplete}
                className="flex items-center gap-1 bg-natural-must-accent hover:bg-natural-must-accent/90 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Done
              </button>
            ) : (
              <>
                <button
                  id="btn-timer-toggle"
                  onClick={toggleTimer}
                  className={`p-2 rounded-full cursor-pointer transition-all ${
                    isActive 
                      ? "bg-[#334155] text-slate-100 hover:bg-[#475569]" 
                      : "bg-natural-accent text-slate-100 hover:bg-natural-accent/90"
                  }`}
                  title={isActive ? "Pause Focus" : "Start Focus"}
                >
                  {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                </button>
                <button
                  id="btn-timer-reset"
                  onClick={resetTimer}
                  className="p-2 rounded-full bg-[#334155] text-slate-400 hover:bg-[#475569] hover:text-slate-100 cursor-pointer transition-all"
                  title="Reset Timer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {isCompleted && (
        <div className="flex items-center gap-2 mt-3 bg-[#0F172A]/40 border border-[#334155] text-slate-200 px-3 py-1.5 rounded text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-natural-must-accent" />
          <span>Timer finished! Check this off and take a brief stretch before starting the next step.</span>
        </div>
      )}
    </div>
  );
}
