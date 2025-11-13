import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import AuthForm from "./components/AuthForm";
import RoutineBoard from "./components/RoutineBoard";
import { endTimeIsoToTimeInput } from "./lib/routines";
import type { CompletedRoutine, RoutineInstance, RoutineTemplate } from "./lib/routines";
import { getSupabaseClient, isSupabaseConfigured } from "./lib/supabaseClient";
import useScreenWakeLock from "./hooks/useScreenWakeLock";
import {
  abandonRoutineRun,
  completeRoutineRun,
  createDefaultRoutineTemplate,
  fetchRoutineState,
  fetchRoutineTemplates,
  resetRoutineRun,
  setRoutineTaskCompleted,
  startRoutineRun
} from "./lib/routineApi";

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [activeRoutine, setActiveRoutine] = useState<RoutineInstance | null>(null);
  const [completedRoutines, setCompletedRoutines] = useState<CompletedRoutine[]>([]);
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templatesReloadToken, setTemplatesReloadToken] = useState(0);
  const [routineStateLoading, setRoutineStateLoading] = useState(false);
  const [routineStateError, setRoutineStateError] = useState<string | null>(null);
  const [routineReloadToken, setRoutineReloadToken] = useState(0);
  const routineFetchIdRef = useRef(0);
  useScreenWakeLock(true);

  const renderAppShell = (content: ReactNode) => <div className="app-shell">{content}</div>;

  if (!isSupabaseConfigured) {
    return renderAppShell(
      <div className="glass-panel">
        <h1>Supabase is not configured</h1>
        <p>
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in an <code>.env</code> file before
          running the app.
        </p>
      </div>
    );
  }

  const supabase = getSupabaseClient();

  useEffect(() => {
    let isMounted = true;

    const initialiseSession = async () => {
      const {
        data: { session: currentSession }
      } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(currentSession);
      setInitializing(false);
    };

    initialiseSession();
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }
      setSession(nextSession);
      setInitializing(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadTemplates = async () => {
      if (!session) {
        if (!isMounted) return;
        setTemplates([]);
        setTemplatesError(null);
        setTemplatesLoading(false);
        return;
      }

      if (!isMounted) return;
      setTemplatesLoading(true);
      setTemplatesError(null);

      try {
        let nextTemplates = await fetchRoutineTemplates(supabase);
        if (nextTemplates.length === 0) {
          await createDefaultRoutineTemplate(supabase);
          nextTemplates = await fetchRoutineTemplates(supabase);
        }
        if (!isMounted) return;
        setTemplates(nextTemplates);
      } catch (error) {
        if (!isMounted) return;
        setTemplatesError(error instanceof Error ? error.message : "Failed to load routine templates");
      } finally {
        if (!isMounted) return;
        setTemplatesLoading(false);
      }
    };

    void loadTemplates();

    return () => {
      isMounted = false;
    };
  }, [session, supabase, templatesReloadToken]);

  useEffect(() => {
    let isMounted = true;
    const fetchId = routineFetchIdRef.current + 1;
    routineFetchIdRef.current = fetchId;

    const loadRoutineState = async () => {
      if (!session) {
        if (!isMounted || routineFetchIdRef.current !== fetchId) return;
        setActiveRoutine(null);
        setCompletedRoutines([]);
        setRoutineStateError(null);
        setRoutineStateLoading(false);
        return;
      }

      if (!isMounted || routineFetchIdRef.current !== fetchId) return;
      setRoutineStateLoading(true);
      setRoutineStateError(null);

      try {
        const { activeRoutine: nextActive, completedRoutines: nextCompleted } = await fetchRoutineState(supabase);
        if (!isMounted || routineFetchIdRef.current !== fetchId) return;
        if (nextActive) {
          setActiveRoutine(nextActive);
        } else {
          setActiveRoutine((current) => {
            if (current && current.status === "completed") {
              return current;
            }
            return null;
          });
        }
        setCompletedRoutines(nextCompleted);
      } catch (error) {
        if (!isMounted || routineFetchIdRef.current !== fetchId) return;
        setRoutineStateError(error instanceof Error ? error.message : "Failed to load routines");
      } finally {
        if (!isMounted || routineFetchIdRef.current !== fetchId) return;
        setRoutineStateLoading(false);
      }
    };

    void loadRoutineState();

    return () => {
      isMounted = false;
    };
  }, [session, supabase, routineReloadToken]);

  const handleSignOut = () => {
    void supabase.auth.signOut();
    setSession(null);
    setActiveRoutine(null);
    setCompletedRoutines([]);
  };

  const handleStartRoutine = async (templateId: string, endTime: string) => {
    const template = templates.find((entry) => entry.id === templateId);
    if (!template) {
      return;
    }
    try {
      const nextRoutine = await startRoutineRun(supabase, template, endTime);
      setActiveRoutine(nextRoutine);
      setRoutineStateError(null);
      setRoutineReloadToken((value) => value + 1);
    } catch (error) {
      console.error(error);
      if (typeof window !== "undefined") {
        window.alert("Failed to start routine. Please try again.");
      }
    }
  };

  const handleToggleTask = async (taskId: string) => {
    const routine = activeRoutine;
    if (!routine || routine.status === "completed") return;

    const taskIndex = routine.tasks.findIndex((task) => task.id === taskId);
    if (taskIndex < 0) return;

    const targetTask = routine.tasks[taskIndex];
    const togglingTo = !targetTask.completed;

    if (togglingTo && targetTask.targetTimeIso) {
      for (let index = taskIndex - 1; index >= 0; index -= 1) {
        const candidate = routine.tasks[index];
        if (candidate.targetTimeIso && !candidate.completed) {
          return;
        }
      }
    }

    try {
      const updatedTask = await setRoutineTaskCompleted(supabase, taskId, togglingTo);
      setActiveRoutine((current) => {
        if (!current || current.id !== updatedTask.runId) {
          return current;
        }
        const updatedTasks = current.tasks.map((task) =>
          task.id === updatedTask.id ? { ...task, ...updatedTask } : task
        );
        return { ...current, tasks: updatedTasks };
      });
    } catch (error) {
      console.error(error);
      if (typeof window !== "undefined") {
        window.alert("Failed to update task. Please try again.");
      }
    }
  };

  const handleResetRoutine = async () => {
    const routine = activeRoutine;
    if (!routine || routine.status === "completed") return;
    const template = templates.find((entry) => entry.id === routine.templateId);
    if (!template) {
      return;
    }
    const endTime = endTimeIsoToTimeInput(routine.endTimeIso);
    try {
      const refreshedRoutine = await resetRoutineRun(supabase, routine, template, endTime);
      setActiveRoutine(refreshedRoutine);
    } catch (error) {
      console.error(error);
      if (typeof window !== "undefined") {
        window.alert("Failed to reset routine. Please try again.");
      }
    }
  };

  const handleExitRoutine = async () => {
    if (!activeRoutine) return;
    try {
      if (activeRoutine.status === "completed") {
        setActiveRoutine(null);
      } else {
        await abandonRoutineRun(supabase, activeRoutine.id);
        setActiveRoutine(null);
      }
      setRoutineReloadToken((value) => value + 1);
    } catch (error) {
      console.error(error);
      if (typeof window !== "undefined") {
        window.alert("Failed to end routine. Please try again.");
      }
    }
  };

  const handleCompleteRoutine = async () => {
    if (!activeRoutine || activeRoutine.status === "completed") return;
    try {
      await completeRoutineRun(supabase, activeRoutine.id);
      setActiveRoutine((current) => {
        if (!current || current.id !== activeRoutine.id) return current;
        return { ...current, status: "completed" };
      });
      setActiveRoutine(null);
      setRoutineReloadToken((value) => value + 1);
    } catch (error) {
      console.error(error);
      if (typeof window !== "undefined") {
        window.alert("Failed to finish routine. Please try again.");
      }
    }
  };

  if (initializing) {
    return renderAppShell(
      <div className="glass-panel loading-state">
        <span className="loading-spinner" aria-hidden="true" />
        <p>Loading your routines…</p>
      </div>
    );
  }

  if (!session) {
    return renderAppShell(<AuthForm />);
  }

  if (templatesLoading || routineStateLoading) {
    return renderAppShell(
      <div className="glass-panel loading-state">
        <span className="loading-spinner" aria-hidden="true" />
        <p>Loading your routines…</p>
      </div>
    );
  }

  if (templatesError) {
    return renderAppShell(
      <div className="glass-panel">
        <h2>We hit a snag loading your templates</h2>
        <p>{templatesError}</p>
        <button
          className="routine-start"
          type="button"
          onClick={() => {
            setTemplatesError(null);
            setTemplatesLoading(true);
            setTemplatesReloadToken((value) => value + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (routineStateError) {
    return renderAppShell(
      <div className="glass-panel">
        <h2>We hit a snag loading your routines</h2>
        <p>{routineStateError}</p>
        <button
          className="routine-start"
          type="button"
          onClick={() => {
            setRoutineStateError(null);
            setRoutineStateLoading(true);
            setRoutineReloadToken((value) => value + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return renderAppShell(
    <RoutineBoard
      userEmail={session.user.email ?? "you"}
      templates={templates}
      history={completedRoutines}
      activeRoutine={activeRoutine}
      supabase={supabase}
      onStartRoutine={handleStartRoutine}
      onToggleTask={handleToggleTask}
      onResetRoutine={handleResetRoutine}
      onExitRoutine={handleExitRoutine}
      onCompleteRoutine={handleCompleteRoutine}
      onTemplatesChanged={() => setTemplatesReloadToken((value) => value + 1)}
      onSignOut={handleSignOut}
    />
  );
};

export default App;
