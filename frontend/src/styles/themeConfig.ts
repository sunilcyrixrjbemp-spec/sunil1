import { ThemeConfig, theme } from "antd";

/**
 * Cyrix Design System Theme Configuration
 * Built on Ant Design v5.
 * Uses compact algorithms and custom styling for a clean, dense dashboard UI.
 */
export const antdTheme: ThemeConfig = {
  // Use the compact algorithm to reduce padding, margins, and element heights globally
  algorithm: theme.compactAlgorithm,
  token: {
    // Primary Color - Cyrix Brand Blue
    colorPrimary: "#4F46E5",
    colorInfo: "#4F46E5",
    colorLink: "#4F46E5",

    // Semantic Colors for Expense/Claim Statuses
    colorSuccess: "#16A34A", // Approved (Green-600)
    colorWarning: "#D97706", // Pending (Amber-600)
    colorError: "#DC2626",   // Rejected (Red-600)

    // Neutral Layout & Background Colors
    colorBgLayout: "#F4F6F9",      // Page main background
    colorBgContainer: "#FFFFFF",   // Cards & White boxes background
    colorBorder: "#E5E7EB",        // Neutral borders (Gray-200)
    colorTextBase: "#1F2937",      // Base text color (Gray-800)

    // Global Typography & Border Radius
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    borderRadius: 6,               // Clean, moderately rounded corners
    fontSize: 13,                  // Modern font scaling base
  },
  components: {
    Button: {
      controlHeight: 32,
      paddingContentHorizontal: 12,
      fontWeight: 600,
    },
    Card: {
      paddingLG: 16,               // Compress large card inner padding from 24px to 16px
      colorBorderSecondary: "#E5E7EB",
      borderRadiusLG: 8,
    },
    Table: {
      fontSize: 12,
      padding: 10,                 // Compact table cells padding
      headerBg: "#F9FAFB",         // Subtle gray for headers
      headerColor: "#4B5563",
      headerSplitColor: "transparent", // Clean borderless header dividers
    },
    Form: {
      itemMarginBottom: 14,        // Reduce gap between form fields
    },
    Tag: {
      borderRadiusSM: 4,
      fontSizeSM: 11,
    },
    Input: {
      controlHeight: 32,
    },
    Select: {
      controlHeight: 32,
    },
    DatePicker: {
      controlHeight: 32,
    },
    Tabs: {
      margin: 0,
      titleFontSize: 13,
      horizontalMargin: "0 0 16px 0",
    },
  },
};
