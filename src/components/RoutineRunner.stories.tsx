import type { Meta, StoryObj } from "@storybook/react";
import RoutineRunner from "./RoutineRunner";
import { sampleActiveRoutine } from "../storybook/fixtures";

const meta: Meta<typeof RoutineRunner> = {
  title: "Routine/RoutineRunner",
  component: RoutineRunner,
  parameters: {
    layout: "fullscreen"
  },
  args: {
    routine: sampleActiveRoutine,
    onToggleTask: () => undefined,
    onReset: () => undefined,
    onExit: () => undefined,
    onCompleteRoutine: () => undefined
  }
};

export default meta;
type Story = StoryObj<typeof RoutineRunner>;

export const ActiveRoutine: Story = {};

export const CompletedRoutine: Story = {
  args: {
    routine: {
      ...sampleActiveRoutine,
      tasks: sampleActiveRoutine.tasks.map((task) => ({ ...task, completed: true })),
      status: "completed"
    }
  }
};
