import { ThemeConfig, theme } from "antd";

/**
 * Cyrix Design System Theme Configuration
 * Built on Ant Design v5 & synced with Tailwind CSS Design Tokens.
 * TailAdmin Aesthetic Benchmark Integration.
 */
export const antdTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // Primary Action Color - Royal Blue 600
    colorPrimary: "#2563EB",
    colorInfo: "#2563EB",
    colorLink: "#2563EB",

    // Immutable Claim Status Semantic Palette
    colorSuccess: "#16A34A", // Approved (Green 600)
    colorWarning: "#D97706", // Pending (Amber 600)
    colorError: "#DC2626",   // Rejected (Red 600)

    // Neutral Surfaces & Layout Colors
    colorBgLayout: "#F8FAFC",      // Slate-50 main canvas
    colorBgContainer: "#FFFFFF",   // Card & Box background
    colorBorder: "#E2E8F0",        // Slate-200 border
    colorBorderSecondary: "#F1F5F9", // Slate-100 border
    colorTextBase: "#0F172A",      // Slate-900 typography base
    colorTextSecondary: "#64748B", // Slate-500 muted text

    // Global Typography & Border Radius
    fontFamily: 'Inter, "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    borderRadius: 8,               // Modern 8px rounded corners
    fontSize: 13,                  // Modern dense base size
  },
  components: {
    Button: {
      controlHeight: 36,
      controlHeightSM: 30,
      controlHeightLG: 42,
      paddingContentHorizontal: 16,
      fontWeight: 600,
      borderRadius: 8,
    },
    Card: {
      paddingLG: 20,
      colorBorderSecondary: "#E2E8F0",
      borderRadiusLG: 12,
    },
    Table: {
      fontSize: 12,
      padding: 12,
      headerBg: "#F8FAFC",
      headerColor: "#475569",
      headerSplitColor: "transparent",
      rowHoverBg: "#F1F5F9",
      borderRadius: 12,
    },
    Form: {
      itemMarginBottom: 16,
      labelFontSize: 13,
      labelColor: "#334155",
    },
    Tag: {
      borderRadiusSM: 6,
      fontSizeSM: 11,
      fontWeightStrong: 700,
    },
    Input: {
      controlHeight: 36,
      controlHeightSM: 30,
      controlHeightLG: 42,
      borderRadius: 8,
    },
    Select: {
      controlHeight: 36,
      controlHeightSM: 30,
      controlHeightLG: 42,
      borderRadius: 8,
    },
    DatePicker: {
      controlHeight: 36,
      controlHeightSM: 30,
      controlHeightLG: 42,
      borderRadius: 8,
    },
    Tabs: {
      margin: 0,
      titleFontSize: 13,
      horizontalMargin: "0 0 16px 0",
      itemColor: "#64748B",
      itemSelectedColor: "#2563EB",
      itemHoverColor: "#1D4ED8",
    },
    Modal: {
      borderRadiusLG: 16,
      headerBg: "#FFFFFF",
      titleFontSize: 16,
    },
    Drawer: {
      borderRadiusLG: 16,
    },
    Badge: {
      fontSize: 11,
    }
  },
};
