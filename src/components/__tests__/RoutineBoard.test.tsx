import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import RoutineBoard from "../RoutineBoard";
import type { CompletedRoutine, RoutineInstance, RoutineTemplate } from "../../lib/routines";

vi.mock("../RoutineRunner", () => ({
  __esModule: true,
  default: () => (
    <div>
      <h2>Mock Routine Runner</h2>
    </div>
  )
}));

vi.mock("../RoutineTemplateEditor", () => ({
  __esModule: true,
  default: ({ onClose, onTemplatesChanged }: { onClose: () => void; onTemplatesChanged: () => void }) => (
    <div>
      <h2>Mock Template Editor</h2>
      <button type="button" onClick={onClose}>
        Close editor
      </button>
      <button type="button" onClick={onTemplatesChanged}>
        Notify change
      </button>
    </div>
  )
}));

const supabase = {} as SupabaseClient;

const template: RoutineTemplate = {
  id: "template-1",
  name: "Evening",
  defaultEndTime: "20:30",
  tasks: [
    { id: "task-1", title: "Brush teeth", targetOffsetMinutes: 15 },
    { id: "task-2", title: "Read", targetOffsetMinutes: undefined }
  ]
};

const history: CompletedRoutine[] = [];

const baseRoutine: RoutineInstance = {
  id: "run-1",
  templateId: template.id,
  name: template.name,
  endTimeIso: new Date("2024-01-01T20:30:00.000Z").toISOString(),
  tasks: [
    {
      id: "task-instance-1",
      title: "Brush teeth",
      helperText: undefined,
      targetTimeIso: new Date("2024-01-01T20:15:00.000Z").toISOString(),
      completed: false,
      templateTaskId: "task-1"
    }
  ],
  startedAtIso: new Date("2024-01-01T19:30:00.000Z").toISOString(),
  status: "in_progress"
};

const renderBoard = (overrides: Partial<ComponentProps<typeof RoutineBoard>> = {}) => {
  const props: ComponentProps<typeof RoutineBoard> = {
    userEmail: "test@example.com",
    templates: overrides.templates ?? [template],
    history: overrides.history ?? history,
    activeRoutine: overrides.activeRoutine ?? null,
    supabase,
    onStartRoutine: overrides.onStartRoutine ?? vi.fn(),
    onToggleTask: overrides.onToggleTask ?? vi.fn(),
    onResetRoutine: overrides.onResetRoutine ?? vi.fn(),
    onExitRoutine: overrides.onExitRoutine ?? vi.fn(),
    onCompleteRoutine: overrides.onCompleteRoutine ?? vi.fn(),
    onTemplatesChanged: overrides.onTemplatesChanged ?? vi.fn(),
    onSignOut: overrides.onSignOut ?? vi.fn(),
    initialView: overrides.initialView ?? "planner"
  };

  return render(<RoutineBoard {...props} />);
};

describe("RoutineBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the runner view when there is an active routine", () => {
    renderBoard({ activeRoutine: baseRoutine });
    expect(screen.getByText(/mock routine runner/i)).toBeVisible();
  });

  it("opens and closes the template editor from the planner", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /manage templates/i }));
    expect(screen.getByText(/mock template editor/i)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /close editor/i }));
    expect(screen.getByText(/plan a routine/i)).toBeVisible();
  });

  it("can start directly in the template editor view", () => {
    renderBoard({ initialView: "editor" });
    expect(screen.getByText(/mock template editor/i)).toBeVisible();
  });

  it("notifies parent when template changes occur inside the editor", () => {
    const onTemplatesChanged = vi.fn();
    renderBoard({ onTemplatesChanged });

    fireEvent.click(screen.getByRole("button", { name: /manage templates/i }));
    fireEvent.click(screen.getByRole("button", { name: /notify change/i }));

    expect(onTemplatesChanged).toHaveBeenCalled();
  });
});
