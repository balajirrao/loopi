import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import RoutineRunner from "../RoutineRunner";
import type { RoutineInstance, RoutineTaskInstance } from "../../lib/routines";

const fixedNow = new Date("2024-01-01T12:00:00.000Z");

const minutesFromNowIso = (minutes: number) => {
  return new Date(fixedNow.getTime() + minutes * 60_000).toISOString();
};

let idCounter = 0;
const nextId = () => {
  idCounter += 1;
  return idCounter;
};

const buildTask = (overrides: Partial<RoutineTaskInstance> = {}): RoutineTaskInstance => {
  const id = overrides.id ?? `task-${nextId()}`;
  return {
    id,
    templateTaskId: overrides.templateTaskId ?? id,
    title: overrides.title ?? "Task",
    helperText: overrides.helperText,
    targetTimeIso: overrides.targetTimeIso,
    completed: overrides.completed ?? false
  };
};

const buildRoutine = (overrides: Partial<RoutineInstance> = {}): RoutineInstance => ({
  id: overrides.id ?? "routine-run",
  templateId: overrides.templateId ?? "template-1",
  name: overrides.name ?? "Evening Routine",
  endTimeIso: overrides.endTimeIso ?? minutesFromNowIso(90),
  tasks:
    overrides.tasks ??
    [
      buildTask({ id: "timed-1", targetTimeIso: minutesFromNowIso(30) }),
      buildTask({ id: "flex-1" })
    ],
  startedAtIso: overrides.startedAtIso ?? fixedNow.toISOString(),
  status: overrides.status ?? "in_progress"
});

const renderRunner = (overrides: Partial<ComponentProps<typeof RoutineRunner>> = {}) => {
  const props: ComponentProps<typeof RoutineRunner> = {
    routine: overrides.routine ?? buildRoutine(),
    onToggleTask: overrides.onToggleTask ?? vi.fn(),
    onReset: overrides.onReset ?? vi.fn(),
    onExit: overrides.onExit ?? vi.fn(),
    onCompleteRoutine: overrides.onCompleteRoutine ?? vi.fn()
  };

  const result = render(<RoutineRunner {...props} />);
  return { props, ...result };
};

describe("RoutineRunner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enforces order for timed tasks before allowing later toggles", () => {
    const firstTimed = buildTask({ id: "timed-1", title: "Lights out", targetTimeIso: minutesFromNowIso(15) });
    const secondTimed = buildTask({ id: "timed-2", title: "Brush teeth", targetTimeIso: minutesFromNowIso(30) });
    const routine = buildRoutine({
      tasks: [firstTimed, secondTimed]
    });
    const onToggleTask = vi.fn();
    renderRunner({ routine, onToggleTask });

    const [firstButton, secondButton] = screen.getAllByRole("listitem");

    expect(firstButton).not.toHaveClass("task-card--disabled");
    expect(secondButton).toHaveClass("task-card--disabled");

    fireEvent.click(firstButton);
    expect(onToggleTask).toHaveBeenCalledWith(firstTimed.id);

    fireEvent.click(secondButton);
    expect(onToggleTask).toHaveBeenCalledTimes(1);
  });

  it("enables finishing the routine only after every task is complete", () => {
    const baseRoutine = buildRoutine();
    const finishHandler = vi.fn();
    const { rerender } = renderRunner({ routine: baseRoutine, onCompleteRoutine: finishHandler });
    const finishButton = screen.getByRole("button", { name: /finish routine/i });

    expect(finishButton).toBeDisabled();

    const completedRoutine: RoutineInstance = {
      ...baseRoutine,
      tasks: baseRoutine.tasks.map((task) => ({ ...task, completed: true }))
    };

    rerender(<RoutineRunner routine={completedRoutine} onCompleteRoutine={finishHandler} onToggleTask={vi.fn()} onReset={vi.fn()} onExit={vi.fn()} />);

    expect(finishButton).toBeEnabled();
    fireEvent.click(finishButton);
    expect(finishHandler).toHaveBeenCalled();
  });

  it("shows next required timed task and swaps to flexible guidance after timed tasks are done", () => {
    const timedTask = buildTask({ id: "timed-1", title: "Pack bag", targetTimeIso: minutesFromNowIso(25) });
    const flexibleTask = buildTask({ id: "flex-1", title: "Read book" });
    const routine = buildRoutine({
      tasks: [timedTask, flexibleTask]
    });
    const { rerender } = renderRunner({ routine });

    expect(screen.getByText(/up next/i)).toHaveTextContent("Pack bag");

    const completedRoutine = {
      ...routine,
      tasks: routine.tasks.map((task) => ({ ...task, completed: true }))
    };

    rerender(
      <RoutineRunner
        routine={completedRoutine}
        onCompleteRoutine={vi.fn()}
        onToggleTask={vi.fn()}
        onReset={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/all timed tasks done/i)).toBeVisible();
  });
});
