import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoutineTemplate } from "../lib/routines";
import {
  deleteRoutineTemplate,
  saveRoutineTemplateDraft,
  type RoutineTemplateTaskDraft
} from "../lib/routineApi";

const NEW_TEMPLATE_ID = "__new__";

type EditableTask = RoutineTemplateTaskDraft & {
  clientId: string;
};

interface EditorDraft {
  id?: string;
  name: string;
  defaultEndTime: string;
  tasks: EditableTask[];
  removedTaskIds: string[];
}

const makeClientId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `task-${Math.random().toString(36).slice(2, 11)}`;
};

const deriveDraftFromTemplate = (template?: RoutineTemplate | null): EditorDraft => {
  if (!template) {
    return {
      id: undefined,
      name: "",
      defaultEndTime: "20:00",
      tasks: [],
      removedTaskIds: []
    };
  }

  return {
    id: template.id,
    name: template.name,
    defaultEndTime: template.defaultEndTime,
    tasks: template.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      targetOffsetMinutes: typeof task.targetOffsetMinutes === "number" ? task.targetOffsetMinutes : null,
      clientId: task.id
    })),
    removedTaskIds: []
  };
};

interface RoutineTemplateEditorProps {
  templates: RoutineTemplate[];
  supabase: SupabaseClient;
  onClose: () => void;
  onTemplatesChanged: () => void;
}

const RoutineTemplateEditor = ({ templates, supabase, onClose, onTemplatesChanged }: RoutineTemplateEditorProps) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => templates[0]?.id ?? NEW_TEMPLATE_ID);
  const [draft, setDraft] = useState<EditorDraft>(() => deriveDraftFromTemplate(templates[0]));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (templates.length === 0 && selectedTemplateId !== NEW_TEMPLATE_ID) {
      setSelectedTemplateId(NEW_TEMPLATE_ID);
      setDraft(deriveDraftFromTemplate(null));
      return;
    }

    if (selectedTemplateId === NEW_TEMPLATE_ID) {
      return;
    }

    if (!templates.some((template) => template.id === selectedTemplateId) && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  useEffect(() => {
    if (selectedTemplateId === NEW_TEMPLATE_ID) {
      setDraft(deriveDraftFromTemplate(null));
      return;
    }
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
    if (selectedTemplate) {
      setDraft(deriveDraftFromTemplate(selectedTemplate));
    }
  }, [selectedTemplateId, templates]);

  const selectedTemplate = useMemo(() => {
    if (selectedTemplateId === NEW_TEMPLATE_ID) {
      return null;
    }
    return templates.find((template) => template.id === selectedTemplateId) ?? null;
  }, [selectedTemplateId, templates]);

  const clearFeedback = () => {
    setStatusMessage(null);
    setError(null);
  };

  const handleDraftChange = (patch: Partial<EditorDraft>) => {
    clearFeedback();
    setDraft((current) => ({ ...current, ...patch }));
  };

  const updateTask = (clientId: string, patch: Partial<EditableTask>) => {
    clearFeedback();
    setDraft((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.clientId === clientId ? { ...task, ...patch } : task))
    }));
  };

  const addTask = () => {
    clearFeedback();
    setDraft((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        {
          clientId: makeClientId(),
          title: "",
          targetOffsetMinutes: null
        }
      ]
    }));
  };

  const removeTask = (clientId: string) => {
    clearFeedback();
    setDraft((current) => {
      const target = current.tasks.find((entry) => entry.clientId === clientId);
      return {
        ...current,
        tasks: current.tasks.filter((task) => task.clientId !== clientId),
        removedTaskIds: target?.id ? [...current.removedTaskIds, target.id] : current.removedTaskIds
      };
    });
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setError("Template name is required");
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      const templateId = await saveRoutineTemplateDraft(supabase, {
        id: draft.id,
        name: draft.name,
        defaultEndTime: draft.defaultEndTime,
        tasks: draft.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          targetOffsetMinutes:
            typeof task.targetOffsetMinutes === "number" ? task.targetOffsetMinutes : task.targetOffsetMinutes ?? null
        })),
        removedTaskIds: draft.removedTaskIds
      });
      setStatusMessage("Saved changes");
      setSelectedTemplateId(templateId);
      setDraft((current) => ({ ...current, id: templateId, removedTaskIds: [] }));
      onTemplatesChanged();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft.id) {
      setSelectedTemplateId(templates[0]?.id ?? NEW_TEMPLATE_ID);
      setDraft(deriveDraftFromTemplate(templates[0]));
      return;
    }

    setDeleting(true);
    setError(null);
    setStatusMessage(null);
    try {
      await deleteRoutineTemplate(supabase, draft.id);
      setSelectedTemplateId(templates.find((template) => template.id !== draft.id)?.id ?? NEW_TEMPLATE_ID);
      setDraft(deriveDraftFromTemplate(templates.find((template) => template.id !== draft.id) ?? null));
      onTemplatesChanged();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setDeleting(false);
    }
  };

  const templateList = useMemo(() => templates, [templates]);

  return (
    <div className="routine-shell glass-panel template-editor">
      <header className="routine-header template-editor__header">
        <div className="routine-greeting">
          <p className="routine-overline">Manage templates</p>
          <h2 className="routine-title">Routine template editor</h2>
        </div>
        <button className="routine-signout routine-exit" onClick={onClose} type="button">
          Back to planner
        </button>
      </header>

      <div className="template-editor__layout">
        <aside className="template-editor__sidebar">
          <div className="template-editor__sidebar-header">
            <h3>Templates</h3>
            <span>{templateList.length} saved</span>
          </div>
          <div className="template-editor__list" role="tablist" aria-label="Template picker">
            {templateList.map((template) => {
              const isActive = template.id === selectedTemplateId;
              return (
                <button
                  key={template.id}
                  className={`template-pill ${isActive ? "template-pill--active" : ""}`}
                  aria-selected={isActive}
                  onClick={() => setSelectedTemplateId(template.id)}
                  type="button"
                >
                  <strong>{template.name}</strong>
                  <span>{template.tasks.length} tasks</span>
                </button>
              );
            })}
            <button
              className={`template-pill ${selectedTemplateId === NEW_TEMPLATE_ID ? "template-pill--active" : ""}`}
              onClick={() => setSelectedTemplateId(NEW_TEMPLATE_ID)}
              type="button"
            >
              <strong>Create template</strong>
              <span>Start from scratch</span>
            </button>
          </div>
        </aside>

        <section className="template-editor__form">
          <div className="template-editor__form-grid">
            <label>
              <span>Template name</span>
              <input
                type="text"
                value={draft.name}
                placeholder="e.g. Bedtime"
                onChange={(event) => handleDraftChange({ name: event.target.value })}
              />
            </label>
            <label>
              <span>Default finish time</span>
              <input
                type="time"
                value={draft.defaultEndTime}
                onChange={(event) => handleDraftChange({ defaultEndTime: event.target.value })}
              />
            </label>
          </div>

          <div className="template-editor__tasks">
            <div className="template-editor__tasks-header">
              <div>
                <p className="task-section__eyebrow">Tasks</p>
                <h3>Steps in this routine</h3>
                <p className="template-editor__hint">
                  Leave minutes empty for flexible checklist items. Timed tasks count backward from the finish time.
                </p>
              </div>
              <button className="template-editor__add-task" type="button" onClick={addTask}>
                Add task
              </button>
            </div>

            {draft.tasks.length === 0 ? (
              <p className="task-section__empty">No tasks yet. Add your first routine step.</p>
            ) : (
              <div className="template-editor__task-list">
                {draft.tasks.map((task) => (
                  <div key={task.clientId} className="template-editor__task-row">
                    <div className="template-editor__task-fields">
                      <label>
                        <span>Task title</span>
                        <input
                          type="text"
                          value={task.title}
                          placeholder="e.g. Brush teeth"
                          onChange={(event) => updateTask(task.clientId, { title: event.target.value })}
                        />
                      </label>
                      <label>
                        <span>Minutes before finish</span>
                        <input
                          type="number"
                          min={0}
                          value={task.targetOffsetMinutes ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (value === "") {
                              updateTask(task.clientId, { targetOffsetMinutes: null });
                              return;
                            }
                            const parsed = Number(value);
                            if (Number.isNaN(parsed) || parsed < 0) {
                              updateTask(task.clientId, { targetOffsetMinutes: null });
                              return;
                            }
                            updateTask(task.clientId, { targetOffsetMinutes: Math.round(parsed) });
                          }}
                        />
                      </label>
                    </div>
                    <button
                      className="template-editor__remove-task"
                      type="button"
                      onClick={() => removeTask(task.clientId)}
                      aria-label={`Remove ${task.title || "task"}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error ? <p className="template-editor__error">{error}</p> : null}
          {statusMessage ? <p className="template-editor__status">{statusMessage}</p> : null}

          <div className="template-editor__actions">
            <button
              className="routine-start"
              type="button"
              onClick={handleSave}
              disabled={saving || deleting || !draft.name.trim()}
            >
              {saving ? "Saving…" : "Save template"}
            </button>
            {selectedTemplate || draft.id ? (
              <button
                className="template-editor__delete"
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting}
              >
                {deleting ? "Deleting…" : "Delete template"}
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
};

export default RoutineTemplateEditor;
