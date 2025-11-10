import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import RoutinePlanner from "./RoutinePlanner";
import RoutineRunner from "./RoutineRunner";
import RoutineTemplateEditor from "./RoutineTemplateEditor";
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
  initialView?: "planner" | "editor";
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
  const [showTemplateEditor, setShowTemplateEditor] = useState(initialView === "editor");

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

  if (showTemplateEditor) {
    return (
      <RoutineTemplateEditor
        templates={templates}
        supabase={supabase}
        onClose={() => setShowTemplateEditor(false)}
        onTemplatesChanged={onTemplatesChanged}
      />
    );
  }

  return (
    <RoutinePlanner
      userEmail={userEmail}
      templates={templates}
      history={history}
      onStartRoutine={onStartRoutine}
      onManageTemplates={() => setShowTemplateEditor(true)}
      onSignOut={onSignOut}
    />
  );
};

export default RoutineBoard;
