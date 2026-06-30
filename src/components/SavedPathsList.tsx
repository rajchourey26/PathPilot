import { Trash2, Calendar, Clock, ChevronRight } from "lucide-react";
import { SavedPath } from "../types";

interface SavedPathsListProps {
  savedPaths: SavedPath[];
  onSelectPath: (path: SavedPath) => void;
  onDeletePath: (id: string) => void;
  activePathId?: string;
}

export default function SavedPathsList({
  savedPaths,
  onSelectPath,
  onDeletePath,
  activePathId,
}: SavedPathsListProps) {
  if (savedPaths.length === 0) {
    return (
      <div id="saved-paths-empty" className="text-center py-8 px-4 border border-dashed border-natural-border rounded-xl text-natural-text-muted text-xs bg-white/50">
        No generated paths saved yet. They will appear here once you generate one!
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div id="saved-paths-list-container" className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
      {savedPaths.map((saved) => {
        const isActive = activePathId === saved.id;
        return (
          <div
            key={saved.id}
            id={`saved-path-item-${saved.id}`}
            className={`group relative flex items-center justify-between p-3.5 rounded-lg border text-left transition-all ${
              isActive
                ? "bg-natural-brand border-natural-brand text-white shadow-sm"
                : "bg-white border-natural-border text-natural-text-main hover:bg-natural-panel hover:border-natural-text-muted/40"
            }`}
          >
            <button
              id={`btn-select-saved-path-${saved.id}`}
              onClick={() => onSelectPath(saved)}
              className="flex-1 min-w-0 pr-8 text-left cursor-pointer"
            >
              <h4 className="font-medium text-xs truncate leading-snug">
                {saved.task}
              </h4>
              <div className={`flex items-center gap-3 mt-1 text-[10px] font-mono ${isActive ? "text-white/80" : "text-natural-text-muted"}`}>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(saved.createdAt)}
                </span>
                {saved.availableHours && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {saved.availableHours}h limit
                  </span>
                )}
              </div>
            </button>

            <button
              id={`btn-delete-saved-path-${saved.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onDeletePath(saved.id);
              }}
              className={`p-1.5 rounded-md border cursor-pointer transition-all ${
                isActive
                  ? "border-natural-brand-hover text-white/75 hover:bg-natural-brand-hover hover:text-red-200"
                  : "border-natural-border text-natural-text-muted hover:bg-natural-skip-bg hover:text-natural-skip-accent hover:border-natural-skip-border"
              }`}
              title="Delete Path"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
