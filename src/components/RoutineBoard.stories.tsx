import type { Meta, StoryObj } from "@storybook/react";
import RoutineBoard from "./RoutineBoard";
import { sampleActiveRoutine, sampleHistory, sampleTemplates, supabaseStub } from "../storybook/fixtures";

const baseArgs = {
  userEmail: "caregiver@example.com",
  templates: sampleTemplates,
  history: sampleHistory,
  supabase: supabaseStub,
  onStartRoutine: () => undefined,
  onToggleTask: () => undefined,
  onResetRoutine: () => undefined,
  onExitRoutine: () => undefined,
  onCompleteRoutine: () => undefined,
  onTemplatesChanged: () => undefined,
  onSignOut: () => undefined
};

const meta: Meta<typeof RoutineBoard> = {
  title: "Routine/RoutineBoard",
  component: RoutineBoard,
  parameters: {
    layout: "fullscreen"
  },
  args: baseArgs
};

export default meta;
type Story = StoryObj<typeof RoutineBoard>;

export const PlannerView: Story = {
  args: {
    activeRoutine: null,
    initialView: "planner"
  }
};

export const TemplateEditorView: Story = {
  args: {
    activeRoutine: null,
    initialView: "editor"
  }
};

export const RunnerView: Story = {
  args: {
    activeRoutine: sampleActiveRoutine
  }
};
