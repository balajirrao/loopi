import type { ComponentProps } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import RoutinePlanner from "../RoutinePlanner";
import type { RoutineTemplate, RoutineTemplateTask } from "../../lib/routines";

const timeStringMinutesAhead = (minutesAhead: number) => {
  const future = new Date(Date.now() + minutesAhead * 60_000);
  const hours = future.getHours().toString().padStart(2, "0");
  const minutes = future.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

let idCounter = 0;
const nextId = () => ++idCounter;

const buildTask = (overrides: Partial<RoutineTemplateTask> = {}): RoutineTemplateTask => ({
  id: overrides.id ?? `task-${nextId()}`,
  title: overrides.title ?? "Task",
  targetOffsetMinutes: overrides.targetOffsetMinutes,
  helperText: overrides.helperText
});

const buildTemplate = (overrides: Partial<RoutineTemplate> = {}): RoutineTemplate => ({
  id: overrides.id ?? `template-${nextId()}`,
  name: overrides.name ?? "Sample template",
  defaultEndTime: overrides.defaultEndTime ?? timeStringMinutesAhead(120),
  tasks:
    overrides.tasks ??
    [
      buildTask({ id: "task-timed", title: "Brush teeth", targetOffsetMinutes: 30 }),
      buildTask({ id: "task-flex", title: "Pack lunch" })
    ]
});

const renderPlanner = (overrides: Partial<ComponentProps<typeof RoutinePlanner>> = {}) => {
  const props: ComponentProps<typeof RoutinePlanner> = {
    userEmail: "test@example.com",
    templates: overrides.templates ?? [buildTemplate()],
    onStartRoutine: overrides.onStartRoutine ?? vi.fn(),
    onManageTemplates: overrides.onManageTemplates ?? vi.fn(),
    onShowHistory: overrides.onShowHistory ?? vi.fn(),
    onSignOut: overrides.onSignOut ?? vi.fn()
  };

  const renderResult = render(<RoutinePlanner {...props} />);
  const startButton = screen.queryByRole("button", { name: /start routine/i }) as HTMLButtonElement | null;
  const timeInput = screen.queryByLabelText(/target finish time/i, { selector: "input" }) as HTMLInputElement | null;

  return { props, startButton, timeInput, ...renderResult };
};

describe("RoutinePlanner", () => {
  const fixedNow = new Date("2024-01-01T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("splits tasks into timed and flexible sections", () => {
    const timedTask = buildTask({ id: "timed", title: "Brush teeth", targetOffsetMinutes: 15 });
    const flexibleTask = buildTask({ id: "flex", title: "Pack lunch" });
    renderPlanner({
      templates: [
        buildTemplate({
          tasks: [timedTask, flexibleTask]
        })
      ]
    });

    const timedSectionHeading = screen.getByRole("heading", { name: /timed tasks/i });
    const timedSection = timedSectionHeading.closest("section");
    expect(timedSection).not.toBeNull();
    expect(within(timedSection as HTMLElement).getByText(timedTask.title)).toBeVisible();

    const flexSectionHeading = screen.getByRole("heading", { name: /anytime tasks/i });
    const flexSection = flexSectionHeading.closest("section");
    expect(flexSection).not.toBeNull();
    expect(within(flexSection as HTMLElement).getByText(flexibleTask.title)).toBeVisible();
  });

  it("defaults to the template end time when there is enough lead time, otherwise falls back", () => {
    const validDefault = timeStringMinutesAhead(180);
    const tightDefault = timeStringMinutesAhead(5);
    const templates = [
      buildTemplate({
        id: "relaxed-template",
        name: "Relaxed",
        defaultEndTime: validDefault,
        tasks: [buildTask({ id: "relaxed-timed", targetOffsetMinutes: 30 })]
      }),
      buildTemplate({
        id: "tight-template",
        name: "Tight window",
        defaultEndTime: tightDefault,
        tasks: [buildTask({ id: "tight-timed", targetOffsetMinutes: 60 })]
      })
    ];

    const { timeInput } = renderPlanner({ templates });
    if (!timeInput) {
      throw new Error("Expected time input to be present");
    }
    expect(timeInput.value).toBe(validDefault);

    const tightTemplateButton = screen.getByRole("tab", { name: /tight window/i });
    fireEvent.click(tightTemplateButton);

    expect(timeInput.value).not.toBe(tightDefault);
    expect(timeInput.value).not.toBe("");
  });

  it("invokes onStartRoutine with the selected template id and end time", () => {
    const onStartRoutine = vi.fn();
    const template = buildTemplate({ id: "template-alpha" });
    const { timeInput, startButton } = renderPlanner({
      templates: [template],
      onStartRoutine
    });
    if (!startButton) {
      throw new Error("Expected start routine button to be present");
    }
    if (!timeInput) {
      throw new Error("Expected time input to be present");
    }
    fireEvent.change(timeInput, { target: { value: "18:45" } });
    fireEvent.click(startButton);

    expect(onStartRoutine).toHaveBeenCalledWith(template.id, "18:45");
  });

  it("hides the start button and prompts for templates when none exist", () => {
    const { startButton } = renderPlanner({ templates: [] });
    expect(startButton).toBeNull();
    expect(screen.getByText(/no templates yet/i)).toBeVisible();
  });

  it("invokes onShowHistory when the nav button is pressed", () => {
    const onShowHistory = vi.fn();
    renderPlanner({ onShowHistory });
    const historyButton = screen.getByRole("button", { name: /completed routines/i });
    fireEvent.click(historyButton);
    expect(onShowHistory).toHaveBeenCalled();
  });
});
