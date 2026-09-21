import { createTheme } from '@mantine/core';

const systemFont =
  "ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'";

/** Friendly, travel-y: teal primary, orange accent for money, rounded md radius. */
export const theme = createTheme({
  primaryColor: 'teal',
  primaryShade: { light: 6, dark: 7 },
  defaultRadius: 'md',
  fontFamily: systemFont,
  headings: { fontFamily: systemFont, fontWeight: '700' },
  cursorType: 'pointer',
  components: {
    Card: { defaultProps: { withBorder: true, radius: 'md', shadow: 'xs' } },
    Button: { defaultProps: { radius: 'md' } },
  },
});

/** Accent color name for money-related UI (amounts, balances). */
export const MONEY_COLOR = 'orange';



