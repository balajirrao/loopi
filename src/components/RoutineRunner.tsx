import { useEffect, useMemo, useState } from "react";
import type { RoutineInstance, RoutineTaskInstance } from "../lib/routines";
import { formatTime } from "../lib/routines";

interface RoutineRunnerProps {
  routine: RoutineInstance;
  onToggleTask: (taskId: string) => void;
  onReset: () => void;
  onExit: () => void;
  onCompleteRoutine: () => void;
}

type TaskWithIndex = {
  task: RoutineTaskInstance;
  index: number;
};

type CountdownTone = "ok" | "warning" | "danger" | "complete";

const useRelativeNow = (refreshMs = 15_000) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const id = window.setInterval(() => setNow(Date.now()), refreshMs);
    return () => {
      window.clearInterval(id);
    };
  }, [refreshMs]);

  return now;
};

const describeCountdown = (task: RoutineTaskInstance, now: number): { label: string; tone: CountdownTone } | null => {
  if (!task.targetTimeIso) {
    return null;
  }
  if (task.completed) {
    return { label: "Completed", tone: "complete" };
  }

  const diffMinutes = Math.ceil((new Date(task.targetTimeIso).getTime() - now) / 60000);

  if (diffMinutes > 5) {
    return { label: `${diffMinutes} min left`, tone: "ok" };
  }
  if (diffMinutes > 0) {
    return { label: `${diffMinutes} min left`, tone: "warning" };
  }
  if (diffMinutes === 0) {
    return { label: "Due now", tone: "warning" };
  }
  return { label: `${Math.abs(diffMinutes)} min overdue`, tone: "danger" };
};

const RoutineRunner = ({ routine, onToggleTask, onReset, onExit, onCompleteRoutine }: RoutineRunnerProps) => {
  const now = useRelativeNow();

  const taskBuckets = useMemo(() => {
    return routine.tasks.reduce<{ timed: TaskWithIndex[]; flexible: TaskWithIndex[] }>(
      (acc, task, index) => {
        const bucket = task.targetTimeIso ? acc.timed : acc.flexible;
        bucket.push({ task, index });
        return acc;
      },
      { timed: [], flexible: [] }
    );
  }, [routine.tasks]);

  const timedTasks = taskBuckets.timed;
  const flexibleTasks = taskBuckets.flexible;

  const allBaseTasksComplete = routine.tasks.every((task) => task.completed);
  const routineArchived = routine.status === "completed";
  const progressPercent = useMemo(() => {
    if (routine.tasks.length === 0) return 0;
    const completedCount = routine.tasks.filter((task) => task.completed).length;
    return Math.round((completedCount / routine.tasks.length) * 100);
  }, [routine.tasks]);

  const canToggleTask = (task: RoutineTaskInstance, index: number) => {
    if (routineArchived) {
      return false;
    }
    if (!task.targetTimeIso || task.completed) {
      return true;
    }

    for (let idx = index - 1; idx >= 0; idx -= 1) {
      const candidate = routine.tasks[idx];
      if (candidate.targetTimeIso && !candidate.completed) {
        return false;
      }
    }

    return true;
  };

  const nextRequiredTask = (): RoutineTaskInstance | null => {
    for (const task of routine.tasks) {
      if (task.targetTimeIso && !task.completed) {
        return task;
      }
    }
    return null;
  };

  const requiredNextTask = nextRequiredTask();
  const badgeForName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "R";
    return trimmed.charAt(0).toUpperCase();
  };

  const renderTaskCard = (entry: TaskWithIndex, bucket: "timed" | "flexible") => {
    const { task, index } = entry;
    const isLastTask = index === routine.tasks.length - 1;
    const toggleAllowed = canToggleTask(task, index);
    const countdown = bucket === "timed" ? describeCountdown(task, now) : null;
    const bucketClass = bucket === "timed" ? "task-card--timed" : "task-card--flex";
    const toneClass =
      bucket === "timed" && countdown && !task.completed
        ? countdown.tone === "danger"
          ? "task-card--late"
          : countdown.tone === "warning"
          ? "task-card--warning"
          : ""
        : "";

    return (
      <button
        key={task.id}
        role="listitem"
        type="button"
        className={`task-card ${bucketClass} ${task.completed ? "task-card--complete" : ""} ${
          isLastTask ? "task-card--final" : ""
        } ${!toggleAllowed ? "task-card--disabled" : ""} ${toneClass}`}
        onClick={() => {
          if (toggleAllowed) {
            onToggleTask(task.id);
          }
        }}
      >
        <div className="task-card__header">
          <div className="task-card__title">
            <h3>{task.title}</h3>
          </div>
          <div className="task-card__meta">
            {bucket === "timed" && task.targetTimeIso ? (
              <>
                <span className="task-card__time">Due {formatTime(task.targetTimeIso)}</span>
                <span
                  className={`task-card__countdown task-card__countdown--${
                    task.completed ? "complete" : countdown?.tone ?? "ok"
                  }`}
                >
                  {task.completed ? "Completed" : countdown?.label}
                </span>
              </>
            ) : (
              <span
                className={`task-card__countdown task-card__countdown--${task.completed ? "complete" : "flex"}`}
              >
                {task.completed ? "Completed" : "Anytime"}
              </span>
            )}
          </div>
        </div>
        <span className="task-card__status">
          {routineArchived
            ? "Routine completed"
            : task.completed
            ? "Completed"
            : bucket === "timed"
            ? toggleAllowed
              ? "Tap when finished to stay on pace"
              : "Complete earlier timed tasks first"
            : "Tap to check off when finished"}
        </span>
      </button>
    );
  };

  const canFinishRoutine = allBaseTasksComplete && !routineArchived;

  return (
    <div className="routine-shell glass-panel routine-runner">
      <header className="routine-header">
        <div className="routine-greeting">
          <p className="routine-overline">Routine in progress</p>
          <h2 className="routine-title">
            <span className="routine-runner__badge" aria-hidden="true">
              {badgeForName(routine.name)}
            </span>
            {routine.name}
          </h2>
        </div>
        <button className="routine-signout routine-exit" onClick={onExit}>
          End routine
        </button>
      </header>

      <div className="routine-status routine-status--runner">
        <span className="routine-status__progress">Progress: {progressPercent}%</span>
        <span className="routine-status__timed">
          Finish by {formatTime(routine.endTimeIso)} · {timedTasks.length} timed task
          {timedTasks.length === 1 ? "" : "s"}
        </span>
        {routineArchived ? (
          <span className="routine-status__complete">Routine completed — nice work!</span>
        ) : requiredNextTask && requiredNextTask.targetTimeIso ? (
          <span className="routine-status__required">
            Up next: <strong>{requiredNextTask.title}</strong> (due {formatTime(requiredNextTask.targetTimeIso)})
          </span>
        ) : (
          <span className="routine-status__complete">All timed tasks done — finish remaining steps when ready.</span>
        )}
      </div>

      <div className="task-sections">
        <section className="task-section task-section--timed">
          <div className="task-section__header">
            <div>
              <p className="task-section__eyebrow">On the clock</p>
              <h3>Timed tasks</h3>
            </div>
            <span className="task-section__hint">Must follow order</span>
          </div>
          {timedTasks.length === 0 ? (
            <p className="task-section__empty">This routine does not have timed steps.</p>
          ) : (
            <div className="task-grid" role="list">
              {timedTasks.map((entry) => renderTaskCard(entry, "timed"))}
            </div>
          )}
        </section>

        <section className="task-section task-section--flex">
          <div className="task-section__header">
            <div>
              <p className="task-section__eyebrow">Flexible</p>
              <h3>Anytime tasks</h3>
            </div>
            <span className="task-section__hint">Do when it fits</span>
          </div>
          {flexibleTasks.length === 0 ? (
            <p className="task-section__empty">Everything today is on a schedule.</p>
          ) : null}
          <div className="task-grid" role="list">
            {flexibleTasks.map((entry) => renderTaskCard(entry, "flexible"))}
          </div>
        </section>
      </div>

      <footer className="routine-footer">
        <button className="routine-reset" type="button" onClick={onReset} disabled={routineArchived}>
          Reset routine
        </button>
        <button
          className="routine-finish"
          type="button"
          onClick={onCompleteRoutine}
          disabled={!canFinishRoutine}
        >
          Finish routine
        </button>
        {routineArchived ? <span className="routine-finish--badge">Completed locally — exit when ready.</span> : null}
      </footer>
    </div>
  );
};

export default RoutineRunner;
