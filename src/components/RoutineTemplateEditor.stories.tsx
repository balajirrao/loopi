import type { Meta, StoryObj } from "@storybook/react";
import RoutineTemplateEditor from "./RoutineTemplateEditor";
import { sampleTemplates, supabaseStub } from "../storybook/fixtures";

const meta: Meta<typeof RoutineTemplateEditor> = {
  title: "Routine/RoutineTemplateEditor",
  component: RoutineTemplateEditor,
  parameters: {
    layout: "fullscreen"
  },
  args: {
    templates: sampleTemplates,
    supabase: supabaseStub,
    onClose: () => undefined,
    onTemplatesChanged: () => undefined
  }
};

export default meta;
type Story = StoryObj<typeof RoutineTemplateEditor>;

export const ManageTemplates: Story = {};

export const EmptyTemplates: Story = {
  args: {
    templates: []
  }
};
