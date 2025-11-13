import type { CompletedRoutine } from "../lib/routines";

interface RoutineHistoryViewProps {
  history: CompletedRoutine[];
  onClose: () => void;
}

const RoutineHistoryView = ({ history, onClose }: RoutineHistoryViewProps) => {
  const badgeForName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "R";
    return trimmed.charAt(0).toUpperCase();
  };

  return (
    <div className="routine-shell glass-panel routine-history-view">
      <header className="routine-header">
        <div className="routine-greeting">
          <p className="routine-overline">Review progress</p>
          <h2 className="routine-title">Completed routines</h2>
        </div>
        <button className="routine-nav__link" onClick={onClose} type="button">
          Back to planner
        </button>
      </header>

      <section className="routine-history routine-history--page">
        <div className="routine-history__header">
          <h3>History</h3>
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

export default RoutineHistoryView;
