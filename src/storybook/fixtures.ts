import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompletedRoutine, RoutineInstance, RoutineTemplate } from "../lib/routines";

export const sampleTemplates: RoutineTemplate[] = [
  {
    id: "template-1",
    name: "Evening Routine",
    defaultEndTime: "20:30",
    tasks: [
      { id: "task-1", title: "Brush teeth", targetOffsetMinutes: 15 },
      { id: "task-2", title: "Pack school bag", targetOffsetMinutes: 30 },
      { id: "task-3", title: "Read story" }
    ]
  },
  {
    id: "template-2",
    name: "Morning Launch",
    defaultEndTime: "07:30",
    tasks: [
      { id: "task-4", title: "Make bed", targetOffsetMinutes: 20 },
      { id: "task-5", title: "Breakfast", targetOffsetMinutes: 40 },
      { id: "task-6", title: "Warm-up stretches" }
    ]
  }
];

export const sampleHistory: CompletedRoutine[] = [
  {
    id: "run-1",
    templateId: "template-1",
    name: "Evening Routine",
    endTimeIso: new Date("2024-01-01T20:30:00.000Z").toISOString(),
    tasks: sampleTemplates[0].tasks.map((task) => ({
      id: `history-${task.id}`,
      title: task.title,
      templateTaskId: task.id,
      helperText: task.helperText,
      targetTimeIso: task.targetOffsetMinutes
        ? new Date(new Date("2024-01-01T20:30:00.000Z").getTime() - task.targetOffsetMinutes * 60_000).toISOString()
        : undefined,
      completed: true
    })),
    completedAtIso: new Date("2024-01-01T20:35:00.000Z").toISOString(),
    startedAtIso: new Date("2024-01-01T19:45:00.000Z").toISOString(),
    status: "completed"
  }
];

export const sampleActiveRoutine: RoutineInstance = {
  id: "active-run",
  templateId: sampleTemplates[0].id,
  name: sampleTemplates[0].name,
  endTimeIso: new Date("2024-01-02T20:30:00.000Z").toISOString(),
  tasks: sampleTemplates[0].tasks.map((task, index) => ({
    id: `active-${task.id}`,
    templateTaskId: task.id,
    title: task.title,
    helperText: task.helperText,
    targetTimeIso: task.targetOffsetMinutes
      ? new Date(new Date("2024-01-02T20:30:00.000Z").getTime() - task.targetOffsetMinutes * 60_000).toISOString()
      : undefined,
    completed: index === 0
  })),
  startedAtIso: new Date("2024-01-02T19:30:00.000Z").toISOString(),
  status: "in_progress"
};

export const supabaseStub = {
  from: () => ({
    insert: () => ({
      select: () => ({
        single: async () => ({ data: { id: "story-template" }, error: null })
      })
    }),
    update: () => ({
      eq: async () => ({ error: null })
    }),
    delete: () => ({
      in: async () => ({ error: null })
    }),
    upsert: async () => ({ error: null })
  })
} as unknown as SupabaseClient;
