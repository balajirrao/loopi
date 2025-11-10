import { useEffect, useMemo, useState } from "react";
import type { CompletedRoutine, RoutineTemplate } from "../lib/routines";
import { formatTime } from "../lib/routines";

const minutesFromNow = (minutesAhead: number): string => {
  const future = new Date(Date.now() + minutesAhead * 60_000);
  const hours = future.getHours().toString().padStart(2, "0");
  const minutes = future.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

const bufferMinutesForTemplate = (template?: RoutineTemplate): number => {
  if (!template) {
    return 30;
  }
  const longestOffset = template.tasks.reduce((max, task) => {
    return typeof task.targetOffsetMinutes === "number" ? Math.max(max, task.targetOffsetMinutes) : max;
  }, 0);
  return Math.max(20, longestOffset + 10);
};

const suggestEndTimeForTemplate = (template?: RoutineTemplate): string => {
  const bufferMinutes = bufferMinutesForTemplate(template);
  const fallback = minutesFromNow(bufferMinutes);

  if (!template) {
    return fallback;
  }

  const [hourString = "", minuteString = ""] = template.defaultEndTime.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return fallback;
  }

  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);
  const leadTimeMs = candidate.getTime() - now.getTime();
  const minLeadMs = bufferMinutes * 60_000;

  if (leadTimeMs < minLeadMs) {
    return fallback;
  }

  return template.defaultEndTime;
};

interface RoutinePlannerProps {
  userEmail: string;
  templates: RoutineTemplate[];
  history: CompletedRoutine[];
  onStartRoutine: (templateId: string, endTime: string) => void;
  onManageTemplates: () => void;
  onSignOut: () => void;
}

const RoutinePlanner = ({
  userEmail,
  templates,
  history,
  onStartRoutine,
  onManageTemplates,
  onSignOut
}: RoutinePlannerProps) => {
  const displayName = useMemo(() => userEmail.split("@")[0], [userEmail]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id ?? "");
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0],
    [selectedTemplateId, templates]
  );

  const [targetEndTime, setTargetEndTime] = useState<string>(() => suggestEndTimeForTemplate(selectedTemplate));

  useEffect(() => {
    if (templates.length === 0) {
      setSelectedTemplateId("");
      setTargetEndTime(suggestEndTimeForTemplate());
      return;
    }

    setSelectedTemplateId((previous) => {
      if (previous && templates.some((template) => template.id === previous)) {
        return previous;
      }
      const firstTemplate = templates[0];
      setTargetEndTime(suggestEndTimeForTemplate(firstTemplate));
      return firstTemplate.id;
    });
  }, [templates]);

  const timedTaskCount = selectedTemplate
    ? selectedTemplate.tasks.filter((task) => typeof task.targetOffsetMinutes === "number").length
    : 0;

  const templateTaskBuckets = useMemo(() => {
    if (!selectedTemplate) {
      return { timed: [], flexible: [] };
    }
    return selectedTemplate.tasks.reduce<{ timed: RoutineTemplate["tasks"]; flexible: RoutineTemplate["tasks"] }>(
      (acc, task) => {
        if (typeof task.targetOffsetMinutes === "number") {
          acc.timed.push(task);
        } else {
          acc.flexible.push(task);
        }
        return acc;
      },
      { timed: [], flexible: [] }
    );
  }, [selectedTemplate]);

  const renderTemplateTask = (
    task: RoutineTemplate["tasks"][number],
    bucket: "timed" | "flexible"
  ) => {
    const bucketClass = bucket === "timed" ? "task-card--timed" : "task-card--flex";
    const hint =
      bucket === "timed"
        ? `${task.targetOffsetMinutes ?? 0} min before finish`
        : "Anytime";
    return (
      <div key={task.id} className={`task-card task-card--preview ${bucketClass}`}>
        <div className="task-card__header">
          <div className="task-card__title">
            <h3>{task.title}</h3>
          </div>
          <span className={`task-card__countdown task-card__countdown--${bucket === "timed" ? "ok" : "flex"}`}>
            {hint}
          </span>
        </div>
      </div>
    );
  };

  const selectedEndTimeLabel = useMemo(() => {
    const [hour, minute] = targetEndTime.split(":").map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      return targetEndTime;
    }
    const now = new Date();
    now.setHours(hour);
    now.setMinutes(minute);
    now.setSeconds(0);
    now.setMilliseconds(0);
    return formatTime(now.toISOString());
  }, [targetEndTime]);

  const handleStartRoutine = () => {
    if (!selectedTemplate) return;
    onStartRoutine(selectedTemplate.id, targetEndTime);
  };

  const badgeForName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "R";
    return trimmed.charAt(0).toUpperCase();
  };

  return (
    <div className="routine-shell glass-panel routine-planner">
      <header className="routine-header">
        <div className="routine-greeting">
          <p className="routine-overline">Plan a routine</p>
          <h2 className="routine-title">
            Hi {displayName}, pick a template to run
          </h2>
        </div>
        <div className="routine-header__actions">
          <button className="routine-manage" onClick={onManageTemplates} type="button">
            Manage templates
          </button>
          <button className="routine-signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="routine-config">
        <div>
          <p className="routine-config__label">Routine templates</p>
          {templates.length === 0 ? (
            <p className="routine-history__empty">
              No templates yet. Seed your database or create a template to get started.
            </p>
          ) : (
            <div className="routine-template-picker" role="tablist" aria-label="Routine template selector">
              {templates.map((template) => {
                const isActive = template.id === selectedTemplateId;
                return (
                  <button
                    key={template.id}
                    role="tab"
                    aria-selected={isActive}
                    className={`routine-template-card ${isActive ? "routine-template-card--active" : ""}`}
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      setTargetEndTime(suggestEndTimeForTemplate(template));
                    }}
                    type="button"
                  >
                    <span className="routine-template-card__badge" aria-hidden="true">
                      {badgeForName(template.name)}
                    </span>
                    <span className="routine-template-card__text">
                      <span className="routine-template-card__name">{template.name}</span>
                      <span className="routine-template-card__tasks">
                        {template.tasks.length} tasks ·{" "}
                        {template.tasks.filter((task) => typeof task.targetOffsetMinutes === "number").length} timed
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedTemplate ? (
          <div className="routine-planner__details">
            <div>
              <label className="routine-config__label" htmlFor="targetEndTime">
                Target finish time
              </label>
              <div className="routine-time-input">
                <input
                  id="targetEndTime"
                  type="time"
                  value={targetEndTime}
                  onChange={(event) => setTargetEndTime(event.target.value)}
                />
                <span className="routine-time-input__hint">
                  {timedTaskCount === 0
                    ? "This template is flexible — tasks act as a checklist."
                    : `Timed tasks schedule backward from ${selectedEndTimeLabel}.`}
                </span>
              </div>
            </div>

            <div className="routine-planner__actions">
              <button
                className="routine-start"
                type="button"
                onClick={handleStartRoutine}
                disabled={templates.length === 0}
              >
                Start routine
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="routine-template-details">
        <h3>Template breakdown</h3>
        {selectedTemplate ? (
          <div className="task-sections">
            <section className="task-section task-section--timed">
              <div className="task-section__header">
                <div>
                  <p className="task-section__eyebrow">On the clock</p>
                  <h3>Timed tasks</h3>
                </div>
              </div>
              {templateTaskBuckets.timed.length === 0 ? (
                <p className="task-section__empty">No scheduled steps in this template.</p>
              ) : (
                <div className="task-grid">{templateTaskBuckets.timed.map((task) => renderTemplateTask(task, "timed"))}</div>
              )}
            </section>
            <section className="task-section task-section--flex">
              <div className="task-section__header">
                <div>
                  <p className="task-section__eyebrow">Flexible</p>
                  <h3>Anytime tasks</h3>
                </div>
              </div>
              {templateTaskBuckets.flexible.length === 0 ? (
                <p className="task-section__empty">Everything here runs on a schedule.</p>
              ) : (
                <div className="task-grid">
                  {templateTaskBuckets.flexible.map((task) => renderTemplateTask(task, "flexible"))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <p>No template selected.</p>
        )}
      </section>

      <section className="routine-history">
        <div className="routine-history__header">
          <h3>Completed routines</h3>
          <span>{history.length} complete</span>
        </div>
        {history.length === 0 ? (
          <p className="routine-history__empty">Run a routine to build streaks and see completion history.</p>
        ) : (
          <ul>
            {history.map((item) => (
              <li key={item.id}>
                <div className="routine-history__meta">
                  <span className="routine-history__badge" aria-hidden="true">
                    {badgeForName(item.name)}
                  </span>
                  <div>
                    <strong>{item.name}</strong>
                    <p>
                      Finished {new Date(item.completedAtIso).toLocaleString([], { hour: "numeric", minute: "2-digit" })}
                      {" · "}
                      {item.tasks.filter((task) => task.completed).length}/{item.tasks.length} tasks checked
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default RoutinePlanner;
