import type { Preview } from '@storybook/react-vite'
import "../src/styles.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
    backgrounds: {
      default: "app",
      values: [
        { name: "app", value: "#11131f" },
        { name: "light", value: "#f5f5f5" }
      ]
    }
  },
};

export default preview;
