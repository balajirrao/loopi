export type RoutineRunStatus = "planned" | "in_progress" | "completed" | "abandoned";

export interface RoutineTemplateTask {
  id: string;
  title: string;
  helperText?: string;
  /**
   * Minutes before end time when the task should be complete.
   * If undefined, the task can happen at any time.
   */
  targetOffsetMinutes?: number;
}

export interface RoutineTemplate {
  id: string;
  name: string;
  defaultEndTime: string;
  tasks: RoutineTemplateTask[];
}

export interface RoutineTaskInstance {
  id: string;
  title: string;
  helperText?: string;
  targetTimeIso?: string;
  completed: boolean;
  templateTaskId: string;
}

export interface RoutineInstance {
  id: string;
  templateId: string;
  name: string;
  endTimeIso: string;
  tasks: RoutineTaskInstance[];
  startedAtIso: string;
  status: RoutineRunStatus;
}

export interface CompletedRoutine {
  id: string;
  templateId: string;
  name: string;
  endTimeIso: string;
  tasks: RoutineTaskInstance[];
  completedAtIso: string;
  startedAtIso: string;
  status: RoutineRunStatus;
}

export const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
};

export const endTimeIsoToTimeInput = (endTimeIso: string): string => {
  const date = new Date(endTimeIso);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};
