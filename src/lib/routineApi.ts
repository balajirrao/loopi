import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompletedRoutine,
  RoutineInstance,
  RoutineRunStatus,
  RoutineTaskInstance,
  RoutineTemplate,
  RoutineTemplateTask
} from "./routines";

type RoutineTemplateRow = {
  id: string;
  name: string;
  default_end_time: string;
  created_at: string;
};

type RoutineTemplateTaskRow = {
  id: string;
  template_id: string;
  title: string;
  target_offset_minutes: number | null;
  created_at: string;
};

type RoutineRunRow = {
  id: string;
  template_id: string | null;
  name: string;
  target_end_time: string;
  started_at: string;
  completed_at: string | null;
  canceled_at: string | null;
  status: RoutineRunStatus;
  routine_run_tasks?: RoutineRunTaskRow[] | null;
};

type RoutineRunTaskRow = {
  id: string;
  run_id: string;
  template_task_id: string | null;
  title: string;
  target_time: string | null;
  completed_at: string | null;
  created_at: string;
};

const minutesToMs = (minutes: number) => minutes * 60 * 1000;

const normaliseTime = (value: string): string => {
  const [hours = "00", minutes = "00"] = value.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
};

const timeStringToDate = (time: string): Date => {
  const [hours, minutes] = time.split(":").map(Number);
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    Number.isNaN(hours) ? 0 : hours,
    Number.isNaN(minutes) ? 0 : minutes,
    0,
    0
  );
};

const calculateTargetTimeIso = (endDate: Date, offsetMinutes: number | undefined): string | null => {
  if (typeof offsetMinutes !== "number") {
    return null;
  }
  return new Date(endDate.getTime() - minutesToMs(offsetMinutes)).toISOString();
};

const sortTasks = (tasks: RoutineTemplateTask[]): RoutineTemplateTask[] => {
  return [...tasks].sort((a, b) => {
    const aOffset = typeof a.targetOffsetMinutes === "number" ? a.targetOffsetMinutes : -1;
    const bOffset = typeof b.targetOffsetMinutes === "number" ? b.targetOffsetMinutes : -1;

    if (typeof a.targetOffsetMinutes === "number" && typeof b.targetOffsetMinutes === "number") {
      return bOffset - aOffset;
    }
    if (typeof a.targetOffsetMinutes === "number") {
      return -1;
    }
    if (typeof b.targetOffsetMinutes === "number") {
      return 1;
    }
    return 0;
  });
};

const mapTaskRowToInstance = (row: RoutineRunTaskRow): RoutineTaskInstance => ({
  id: row.id,
  title: row.title,
  targetTimeIso: row.target_time ?? undefined,
  completed: Boolean(row.completed_at),
  templateTaskId: row.template_task_id ?? row.id
});

const mapRunRowToRoutineInstance = (row: RoutineRunRow): RoutineInstance => {
  const tasks = (row.routine_run_tasks ?? []).map(mapTaskRowToInstance);
  return {
    id: row.id,
    templateId: row.template_id ?? row.id,
    name: row.name,
    endTimeIso: row.target_end_time,
    tasks,
    startedAtIso: row.started_at,
    status: row.status as RoutineRunStatus
  };
};

const mapRunRowToCompletedRoutine = (row: RoutineRunRow): CompletedRoutine => {
  const instance = mapRunRowToRoutineInstance(row);
  return {
    ...instance,
    completedAtIso: row.completed_at ?? instance.startedAtIso
  };
};

const fetchRunsWithStatus = async (
  supabase: SupabaseClient,
  statuses: RoutineRunStatus[],
  options: { limit?: number; orderField: "started_at" | "completed_at"; ascending: boolean }
): Promise<RoutineRunRow[]> => {
  const query = supabase
    .from("routine_runs")
    .select(
      "id, template_id, name, target_end_time, started_at, completed_at, canceled_at, status, routine_run_tasks (id, run_id, template_task_id, title, target_time, completed_at, created_at)"
    )
    .in("status", statuses)
    .order(options.orderField, { ascending: options.ascending });

  if (options.limit) {
    query.limit(options.limit);
  }

  query.order("created_at", { referencedTable: "routine_run_tasks", ascending: true });

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load routine runs: ${error.message}`);
  }

  return (data ?? []) as RoutineRunRow[];
};

const DEFAULT_TEMPLATE_NAME = "Evening Routine";
const DEFAULT_TEMPLATE_END_TIME = "20:30";
const DEFAULT_TEMPLATE_TASKS: Array<{ title: string; targetOffsetMinutes?: number }> = [
  { title: "Play Game", targetOffsetMinutes: 10 },
  { title: "Brush Teeth", targetOffsetMinutes: 15 },
  { title: "Desert", targetOffsetMinutes: 30 },
  { title: "Dry Fruits" }
];

export const fetchRoutineTemplates = async (supabase: SupabaseClient): Promise<RoutineTemplate[]> => {
  const {
    data: templateRows,
    error: templateError
  } = await supabase
    .from("routine_templates")
    .select("id, name, default_end_time, created_at")
    .order("created_at", { ascending: true });

  if (templateError) {
    throw new Error(`Failed to load routine templates: ${templateError.message}`);
  }

  const templateRowsTyped = (templateRows ?? []) as RoutineTemplateRow[];

  if (templateRowsTyped.length === 0) {
    return [];
  }

  const tasksByTemplateId = new Map<string, RoutineTemplateTask[]>();
  const templateIds = templateRowsTyped.map((row) => row.id);

  if (templateIds.length > 0) {
    const {
      data: taskRows,
      error: taskError
    } = await supabase
      .from("routine_template_tasks")
      .select("id, template_id, title, target_offset_minutes, created_at")
      .in("template_id", templateIds)
      .order("target_offset_minutes", { ascending: false, nullsFirst: false });

    if (taskError) {
      throw new Error(`Failed to load routine template tasks: ${taskError.message}`);
    }

    const taskRowsTyped = (taskRows ?? []) as RoutineTemplateTaskRow[];

    for (const row of taskRowsTyped) {
      const task: RoutineTemplateTask = {
        id: row.id,
        title: row.title,
        targetOffsetMinutes: row.target_offset_minutes ?? undefined
      };
      const tasks = tasksByTemplateId.get(row.template_id) ?? [];
      tasks.push(task);
      tasksByTemplateId.set(row.template_id, tasks);
    }
  }

  return templateRowsTyped.map((row) => ({
    id: row.id,
    name: row.name,
    defaultEndTime: normaliseTime(row.default_end_time),
    tasks: sortTasks(tasksByTemplateId.get(row.id) ?? [])
  }));
};

export const createDefaultRoutineTemplate = async (supabase: SupabaseClient): Promise<void> => {
  const {
    data: templateRow,
    error: templateError
  } = await supabase
    .from("routine_templates")
    .insert({
      name: DEFAULT_TEMPLATE_NAME,
      default_end_time: DEFAULT_TEMPLATE_END_TIME
    })
    .select("id")
    .single();

  if (templateError || !templateRow) {
    throw new Error(`Failed to create default template: ${templateError?.message ?? "Unknown error"}`);
  }

  const taskPayloads = DEFAULT_TEMPLATE_TASKS.map((task) => ({
    template_id: templateRow.id,
    title: task.title,
    target_offset_minutes: typeof task.targetOffsetMinutes === "number" ? task.targetOffsetMinutes : null
  }));

  const {
    error: taskError
  } = await supabase.from("routine_template_tasks").insert(taskPayloads);

  if (taskError) {
    throw new Error(`Failed to create default template tasks: ${taskError.message}`);
  }
};

export const fetchRoutineState = async (
  supabase: SupabaseClient
): Promise<{ activeRoutine: RoutineInstance | null; completedRoutines: CompletedRoutine[] }> => {
  const [activeRuns, completedRuns] = await Promise.all([
    fetchRunsWithStatus(supabase, ["planned", "in_progress"], { orderField: "started_at", ascending: false, limit: 1 }),
    fetchRunsWithStatus(supabase, ["completed"], { orderField: "completed_at", ascending: false, limit: 20 })
  ]);

  const activeRoutine = activeRuns.length > 0 ? mapRunRowToRoutineInstance(activeRuns[0]) : null;
  const completedRoutines = completedRuns.map(mapRunRowToCompletedRoutine);

  return { activeRoutine, completedRoutines };
};

export const startRoutineRun = async (
  supabase: SupabaseClient,
  template: RoutineTemplate,
  endTime: string
): Promise<RoutineInstance> => {
  const endDate = timeStringToDate(endTime);
  const endTimeIso = endDate.toISOString();

  const {
    data: runRow,
    error: runError
  } = await supabase
    .from("routine_runs")
    .insert({
      template_id: template.id,
      name: template.name,
      target_end_time: endTimeIso,
      status: "in_progress"
    })
    .select("id, template_id, name, target_end_time, started_at, completed_at, canceled_at, status")
    .single();

  if (runError || !runRow) {
    throw new Error(`Failed to start routine: ${runError?.message ?? "Unknown error"}`);
  }

  const taskPayloads = template.tasks.map((task) => ({
    run_id: runRow.id,
    template_task_id: task.id,
    title: task.title,
    target_time: calculateTargetTimeIso(endDate, task.targetOffsetMinutes)
  }));

  const {
    data: insertedTasks,
    error: taskError
  } = await supabase
    .from("routine_run_tasks")
    .insert(taskPayloads)
    .select("id, run_id, template_task_id, title, target_time, completed_at, created_at");

  if (taskError) {
    throw new Error(`Failed to create routine tasks: ${taskError.message}`);
  }

  const tasksByTemplateId = new Map(
    (insertedTasks ?? []).map((row) => [row.template_task_id ?? row.id, mapTaskRowToInstance(row)])
  );

  const orderedTemplateTasks: RoutineTaskInstance[] = template.tasks.map((task) => {
    const inserted = tasksByTemplateId.get(task.id);
    if (!inserted) {
      return {
        id: `${runRow.id}-${task.id}`,
        title: task.title,
        targetTimeIso: calculateTargetTimeIso(endDate, task.targetOffsetMinutes) ?? undefined,
        completed: false,
        templateTaskId: task.id
      };
    }
    return inserted;
  });

  const templateTaskIdSet = new Set(template.tasks.map((task) => task.id));
  const additionalTasks =
    insertedTasks
      ?.filter((row) => {
        const templateTaskId = row.template_task_id ?? "";
        return !templateTaskIdSet.has(templateTaskId);
      })
      .map(mapTaskRowToInstance) ?? [];

  return {
    id: runRow.id,
    templateId: template.id,
    name: runRow.name,
    endTimeIso: runRow.target_end_time,
    tasks: [...orderedTemplateTasks, ...additionalTasks],
    startedAtIso: runRow.started_at,
    status: runRow.status as RoutineRunStatus
  };
};

export const setRoutineTaskCompleted = async (
  supabase: SupabaseClient,
  taskId: string,
  completed: boolean
): Promise<RoutineTaskInstance & { runId: string }> => {
  const {
    data: updatedRow,
    error
  } = await supabase
    .from("routine_run_tasks")
    .update({
      completed_at: completed ? new Date().toISOString() : null
    })
    .eq("id", taskId)
    .select("id, run_id, template_task_id, title, target_time, completed_at, created_at")
    .single();

  if (error || !updatedRow) {
    throw new Error(`Failed to update routine task: ${error?.message ?? "Unknown error"}`);
  }

  const taskInstance = mapTaskRowToInstance(updatedRow);
  return { ...taskInstance, runId: updatedRow.run_id };
};

export const completeRoutineRun = async (supabase: SupabaseClient, runId: string): Promise<void> => {
  const {
    error
  } = await supabase
    .from("routine_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString()
    })
    .eq("id", runId);

  if (error) {
    throw new Error(`Failed to complete routine: ${error.message}`);
  }
};

export const abandonRoutineRun = async (supabase: SupabaseClient, runId: string): Promise<void> => {
  const {
    error
  } = await supabase
    .from("routine_runs")
    .update({
      status: "abandoned",
      canceled_at: new Date().toISOString()
    })
    .eq("id", runId);

  if (error) {
    throw new Error(`Failed to abandon routine: ${error.message}`);
  }
};

export const resetRoutineRun = async (
  supabase: SupabaseClient,
  run: RoutineInstance,
  template: RoutineTemplate,
  endTime: string
): Promise<RoutineInstance> => {
  const endDate = timeStringToDate(endTime);
  const endTimeIso = endDate.toISOString();

  const {
    data: updatedRun,
    error: runError
  } = await supabase
    .from("routine_runs")
    .update({
      target_end_time: endTimeIso,
      started_at: new Date().toISOString(),
      completed_at: null,
      status: "in_progress"
    })
    .eq("id", run.id)
    .select("id, template_id, name, target_end_time, started_at, completed_at, canceled_at, status")
    .single();

  if (runError || !updatedRun) {
    throw new Error(`Failed to reset routine: ${runError?.message ?? "Unknown error"}`);
  }

  const existingTasksByTemplateId = new Map(run.tasks.map((task) => [task.templateTaskId, task]));

  const taskUpdates = template.tasks
    .map((task) => {
      const existingTask = existingTasksByTemplateId.get(task.id);
      if (!existingTask) {
        return null;
      }
      return {
        id: existingTask.id,
        title: task.title,
        target_time: calculateTargetTimeIso(endDate, task.targetOffsetMinutes),
        completed_at: null
      };
    })
    .filter((entry): entry is { id: string; title: string; target_time: string | null; completed_at: null } => Boolean(entry));

  if (taskUpdates.length > 0) {
    const {
      error: tasksError
    } = await supabase
      .from("routine_run_tasks")
      .upsert(taskUpdates, { onConflict: "id" });

    if (tasksError) {
      throw new Error(`Failed to reset routine tasks: ${tasksError.message}`);
    }
  }

  const newTasks = template.tasks
    .filter((task) => !existingTasksByTemplateId.has(task.id))
    .map((task) => ({
      run_id: run.id,
      template_task_id: task.id,
      title: task.title,
      target_time: calculateTargetTimeIso(endDate, task.targetOffsetMinutes)
    }));

  if (newTasks.length > 0) {
    const {
      error: insertError
    } = await supabase
      .from("routine_run_tasks")
      .insert(newTasks);

    if (insertError) {
      throw new Error(`Failed to add new routine tasks: ${insertError.message}`);
    }
  }

  const {
    data: refreshedTasks,
    error: fetchError
  } = await supabase
    .from("routine_run_tasks")
    .select("id, run_id, template_task_id, title, target_time, completed_at, created_at")
    .eq("run_id", run.id)
    .order("created_at", { ascending: true });

  if (fetchError) {
    throw new Error(`Failed to load routine tasks: ${fetchError.message}`);
  }

  const refreshedInstances = (refreshedTasks ?? []).map(mapTaskRowToInstance);
  const byTemplateId = new Map(refreshedInstances.map((task) => [task.templateTaskId, task]));

  const orderedTemplateTasks: RoutineTaskInstance[] = template.tasks
    .map((task) => byTemplateId.get(task.id))
    .filter((task): task is RoutineTaskInstance => Boolean(task));

  const templateTaskIds = new Set(template.tasks.map((task) => task.id));
  const additionalTasks = refreshedInstances.filter((task) => !templateTaskIds.has(task.templateTaskId));

  return {
    id: updatedRun.id,
    templateId: template.id,
    name: updatedRun.name,
    endTimeIso: updatedRun.target_end_time,
    tasks: [...orderedTemplateTasks, ...additionalTasks],
    startedAtIso: updatedRun.started_at,
    status: updatedRun.status as RoutineRunStatus
  };
};
