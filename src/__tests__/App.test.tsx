import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import App from "../App";
import type { RoutineInstance, RoutineTemplate } from "../lib/routines";

let mockIsConfigured = true;

const {
  mockSignOut,
  mockGetSession,
  mockOnAuthStateChange,
  mockFetchRoutineTemplates,
  mockCreateDefaultRoutineTemplate,
  mockFetchRoutineState,
  mockStartRoutineRun,
  mockResetRoutineRun,
  mockAbandonRoutineRun,
  mockCompleteRoutineRun,
  mockSetRoutineTaskCompleted
} = vi.hoisted(() => {
  return {
    mockSignOut: vi.fn(),
    mockGetSession: vi.fn(),
    mockOnAuthStateChange: vi.fn(),
    mockFetchRoutineTemplates: vi.fn(),
    mockCreateDefaultRoutineTemplate: vi.fn(),
    mockFetchRoutineState: vi.fn(),
    mockStartRoutineRun: vi.fn(),
    mockResetRoutineRun: vi.fn(),
    mockAbandonRoutineRun: vi.fn(),
    mockCompleteRoutineRun: vi.fn(),
    mockSetRoutineTaskCompleted: vi.fn()
  };
});

const mockSupabase = {
  auth: {
    getSession: mockGetSession,
    onAuthStateChange: mockOnAuthStateChange,
    signOut: mockSignOut
  }
};

vi.mock("../lib/supabaseClient", () => ({
  getSupabaseClient: () => mockSupabase,
  get isSupabaseConfigured() {
    return mockIsConfigured;
  }
}));

vi.mock("../lib/routineApi", async () => {
  const actual = await vi.importActual<typeof import("../lib/routineApi")>("../lib/routineApi");
  return {
    ...actual,
    fetchRoutineTemplates: mockFetchRoutineTemplates,
    createDefaultRoutineTemplate: mockCreateDefaultRoutineTemplate,
    fetchRoutineState: mockFetchRoutineState,
    startRoutineRun: mockStartRoutineRun,
    resetRoutineRun: mockResetRoutineRun,
    abandonRoutineRun: mockAbandonRoutineRun,
    completeRoutineRun: mockCompleteRoutineRun,
    setRoutineTaskCompleted: mockSetRoutineTaskCompleted
  };
});

const baseTemplate: RoutineTemplate = {
  id: "template-1",
  name: "Evening Routine",
  defaultEndTime: "20:30",
  tasks: [
    {
      id: "template-task-1",
      title: "Brush teeth",
      targetOffsetMinutes: 15
    }
  ]
};

const activeRoutine: RoutineInstance = {
  id: "run-1",
  templateId: baseTemplate.id,
  name: baseTemplate.name,
  endTimeIso: new Date("2024-01-01T18:30:00.000Z").toISOString(),
  tasks: [
    {
      id: "task-instance-1",
      title: "Brush teeth",
      helperText: undefined,
      targetTimeIso: new Date("2024-01-01T18:15:00.000Z").toISOString(),
      completed: false,
      templateTaskId: "template-task-1"
    }
  ],
  startedAtIso: new Date("2024-01-01T17:30:00.000Z").toISOString(),
  status: "in_progress"
};

const session = {
  user: {
    id: "user-1",
    email: "parent@example.com",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: "",
    last_sign_in_at: "",
    updated_at: ""
  },
  expires_at: 0,
  expires_in: 0,
  token_type: "bearer",
  access_token: "",
  refresh_token: ""
} as unknown as Session;

const subscription = { unsubscribe: vi.fn() };

const resolvePlannerState = () => {
  mockFetchRoutineTemplates.mockResolvedValue([baseTemplate]);
  mockFetchRoutineState.mockResolvedValue({ activeRoutine: null, completedRoutines: [] });
};

beforeAll(() => {
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

beforeEach(() => {
  mockIsConfigured = true;
  mockSignOut.mockResolvedValue({});
  mockGetSession.mockResolvedValue({ data: { session } });
  mockOnAuthStateChange.mockReturnValue({ data: { subscription } });
  resolvePlannerState();
  mockCreateDefaultRoutineTemplate.mockReset();
  mockStartRoutineRun.mockResolvedValue(activeRoutine);
  mockResetRoutineRun.mockResolvedValue(activeRoutine);
  mockAbandonRoutineRun.mockResolvedValue(undefined);
  mockCompleteRoutineRun.mockResolvedValue(undefined);
  mockSetRoutineTaskCompleted.mockResolvedValue({ ...activeRoutine.tasks[0], runId: activeRoutine.id });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("App routine board states", () => {
  it("shows a Supabase configuration warning when env vars are missing", () => {
    mockIsConfigured = false;
    render(<App />);
    expect(screen.getByText(/Supabase is not configured/i)).toBeVisible();
  });

  it("renders the planner once templates and routine state load", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Manage templates/i })).toBeVisible();
    });

    expect(mockFetchRoutineTemplates).toHaveBeenCalledTimes(1);
    expect(mockFetchRoutineState).toHaveBeenCalledTimes(1);
  });

  it("shows the runner when an active routine is returned", async () => {
    mockFetchRoutineState.mockResolvedValue({
      activeRoutine,
      completedRoutines: []
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Routine in progress/i)).toBeVisible();
    });
  });

  it("opens the template editor when Manage templates is clicked", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Manage templates/i })).toBeVisible();
    });

    fireEvent.click(screen.getByRole("button", { name: /Manage templates/i }));

    expect(await screen.findByText(/Routine template editor/i)).toBeVisible();
  });
});
