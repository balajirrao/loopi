import type { Meta, StoryObj } from "@storybook/react";
import RoutinePlanner from "./RoutinePlanner";
import { sampleHistory, sampleTemplates } from "../storybook/fixtures";

const meta: Meta<typeof RoutinePlanner> = {
  title: "Routine/RoutinePlanner",
  component: RoutinePlanner,
  parameters: {
    layout: "fullscreen"
  },
  args: {
    userEmail: "caregiver@example.com",
    templates: sampleTemplates,
    history: sampleHistory,
    onStartRoutine: () => undefined,
    onManageTemplates: () => undefined,
    onSignOut: () => undefined
  }
};

export default meta;
type Story = StoryObj<typeof RoutinePlanner>;

export const DefaultPlanner: Story = {};

export const EmptyState: Story = {
  args: {
    templates: [],
    history: []
  }
};
