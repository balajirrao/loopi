import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import RoutinePlanner from "./RoutinePlanner";
import RoutineRunner from "./RoutineRunner";
import RoutineTemplateEditor from "./RoutineTemplateEditor";
import RoutineHistoryView from "./RoutineHistoryView";
import type { CompletedRoutine, RoutineInstance, RoutineTemplate } from "../lib/routines";

interface RoutineBoardProps {
  userEmail: string;
  templates: RoutineTemplate[];
  history: CompletedRoutine[];
  activeRoutine: RoutineInstance | null;
  supabase: SupabaseClient;
  onStartRoutine: (templateId: string, endTime: string) => void;
  onToggleTask: (taskId: string) => void;
  onResetRoutine: () => void;
  onExitRoutine: () => void;
  onCompleteRoutine: () => void;
  onTemplatesChanged: () => void;
  onSignOut: () => void;
  initialView?: "planner" | "editor" | "history";
}

const RoutineBoard = ({
  userEmail,
  templates,
  history,
  activeRoutine,
  supabase,
  onStartRoutine,
  onToggleTask,
  onResetRoutine,
  onExitRoutine,
  onCompleteRoutine,
  onTemplatesChanged,
  onSignOut,
  initialView = "planner"
}: RoutineBoardProps) => {
  const [boardView, setBoardView] = useState<"planner" | "editor" | "history">(initialView);

  if (activeRoutine) {
    return (
      <RoutineRunner
        routine={activeRoutine}
        onToggleTask={onToggleTask}
        onReset={onResetRoutine}
        onExit={onExitRoutine}
        onCompleteRoutine={onCompleteRoutine}
      />
    );
  }

  if (boardView === "editor") {
    return (
      <RoutineTemplateEditor
        templates={templates}
        supabase={supabase}
        onClose={() => setBoardView("planner")}
        onTemplatesChanged={onTemplatesChanged}
      />
    );
  }

  if (boardView === "history") {
    return <RoutineHistoryView history={history} onClose={() => setBoardView("planner")} />;
  }

  return (
    <RoutinePlanner
      userEmail={userEmail}
      templates={templates}
      onStartRoutine={onStartRoutine}
      onManageTemplates={() => setBoardView("editor")}
      onShowHistory={() => setBoardView("history")}
      onSignOut={onSignOut}
    />
  );
};

export default RoutineBoard;
