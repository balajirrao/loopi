import type { SupabaseClient } from "@supabase/supabase-js";
import { createDefaultRoutineTemplate, saveRoutineTemplateDraft } from "../routineApi";

const makeSupabaseForDefaultTemplate = () => {
  const singleMock = vi.fn().mockResolvedValue({ data: { id: "template-123" }, error: null });
  const selectMock = vi.fn(() => ({ single: singleMock }));
  const templateInsertMock = vi.fn(() => ({ select: selectMock }));
  const taskInsertMock = vi.fn().mockResolvedValue({ error: null });

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "routine_templates") {
        return {
          insert: templateInsertMock
        };
      }
      if (table === "routine_template_tasks") {
        return {
          insert: taskInsertMock
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    })
  } as unknown as SupabaseClient;

  return { supabase, templateInsertMock, selectMock, singleMock, taskInsertMock };
};

describe("routineApi.createDefaultRoutineTemplate", () => {
  it("creates the seed template and associated tasks", async () => {
    const { supabase, templateInsertMock, taskInsertMock } = makeSupabaseForDefaultTemplate();

    await createDefaultRoutineTemplate(supabase);

    expect(templateInsertMock).toHaveBeenCalledWith({
      name: "Evening Routine",
      default_end_time: "20:30"
    });

    expect(taskInsertMock).toHaveBeenCalledTimes(1);
    const payload = taskInsertMock.mock.calls[0][0];
    expect(payload).toHaveLength(4);
    expect(payload[0]).toMatchObject({
      template_id: "template-123",
      title: expect.any(String)
    });
  });
});

const makeTaskTableMocks = () => {
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const deleteInMock = vi.fn().mockResolvedValue({ error: null });
  const deleteMock = vi.fn(() => ({ in: deleteInMock }));

  return { upsertMock, insertMock, deleteMock, deleteInMock };
};

describe("routineApi.saveRoutineTemplateDraft", () => {
  it("updates an existing template with sanitised fields and syncs tasks", async () => {
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: updateEqMock }));
    const { upsertMock, insertMock, deleteMock, deleteInMock } = makeTaskTableMocks();

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "routine_templates") {
          return {
            update: updateMock
          };
        }
        if (table === "routine_template_tasks") {
          return {
            upsert: upsertMock,
            insert: insertMock,
            delete: deleteMock
          };
        }
        throw new Error(`Unexpected table ${table}`);
      })
    } as unknown as SupabaseClient;

    const draft = {
      id: "template-1",
      name: "  Bedtime  ",
      defaultEndTime: "7:5",
      tasks: [
        { id: "task-1", title: "  Brush teeth  ", targetOffsetMinutes: 15 },
        { title: "Journal time", targetOffsetMinutes: -10 },
        { id: "task-2", title: "", targetOffsetMinutes: 5 }
      ],
      removedTaskIds: ["task-removed"]
    };

    const templateId = await saveRoutineTemplateDraft(supabase, draft);

    expect(templateId).toBe(draft.id);
    expect(updateMock).toHaveBeenCalledWith({
      name: "Bedtime",
      default_end_time: "07:05"
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", draft.id);

    expect(upsertMock).toHaveBeenCalledWith(
      [
        {
          id: "task-1",
          template_id: draft.id,
          title: "Brush teeth",
          target_offset_minutes: 15
        }
      ],
      { onConflict: "id" }
    );

    expect(insertMock).toHaveBeenCalledWith([
      {
        template_id: draft.id,
        title: "Journal time",
        target_offset_minutes: null
      }
    ]);

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteInMock).toHaveBeenCalledWith("id", ["task-removed"]);
  });

  it("creates a new template when no id is provided", async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: { id: "new-template" }, error: null });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertTemplateMock = vi.fn(() => ({ select: selectMock }));
    const { upsertMock, insertMock } = makeTaskTableMocks();

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "routine_templates") {
          return {
            insert: insertTemplateMock
          };
        }
        if (table === "routine_template_tasks") {
          return {
            upsert: upsertMock,
            insert: insertMock,
            delete: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ error: null }) }))
          };
        }
        throw new Error(`Unexpected table ${table}`);
      })
    } as unknown as SupabaseClient;

    const draft = {
      name: " Morning ",
      defaultEndTime: "6:0",
      tasks: [{ title: "Stretch", targetOffsetMinutes: 5 }]
    };

    const templateId = await saveRoutineTemplateDraft(supabase, draft);

    expect(templateId).toBe("new-template");
    expect(insertTemplateMock).toHaveBeenCalledWith({
      name: "Morning",
      default_end_time: "06:00"
    });
    expect(upsertMock).not.toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledWith([
      {
        template_id: "new-template",
        title: "Stretch",
        target_offset_minutes: 5
      }
    ]);
  });
});
