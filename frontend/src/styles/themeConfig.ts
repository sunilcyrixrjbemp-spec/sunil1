import { ThemeConfig, theme } from "antd";

/**
 * Cyrix Ledger — Ant Design v5 Theme
 * Aligned with Tailwind design tokens in tailwind.config.js.
 * Philosophy: flat + bordered, single confident indigo accent,
 * tabular-mono for financial data, deliberate friction on high-stakes actions.
 */
export const antdTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // ─── Brand Accent — Royal Blue Refined (#2563EB) ──────
    colorPrimary: "#2563EB",   // accent-600
    colorInfo:    "#2563EB",
    colorLink:    "#2563EB",
    colorLinkHover: "#1D4ED8",

    // ─── Immutable Status Palette ─────────────────────────
    colorSuccess: "#16A34A",   // approved
    colorWarning: "#D97706",   // pending
    colorError:   "#DC2626",   // rejected

    // ─── Canvas & Surfaces ────────────────────────────────
    colorBgLayout:    "#F8FAFC",   // surface-50 page bg
    colorBgContainer: "#FFFFFF",   // surface-0 card background
    colorBgElevated:  "#FFFFFF",   // dropdown / popover
    colorBgSpotlight: "#F1F5F9",   // surface-100 table header / sunken

    // ─── Borders ─────────────────────────────────────────
    colorBorder:          "#E5E7EB",  // border
    colorBorderSecondary: "#F1F5F9",  // surface-100

    // ─── Typography ──────────────────────────────────────
    colorText:          "#0B0F19",  // ink-900
    colorTextSecondary: "#374151",  // ink-700
    colorTextTertiary:  "#6B7280",  // ink-500
    colorTextQuaternary:"#D1D5DB",  // ink-300

    // ─── Global Defaults ─────────────────────────────────
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSize:   14,
    borderRadius:  10,    // radius-md
    lineWidth:     1,
    motionDurationMid: "0.15s",
    motionDurationSlow: "0.22s",
    motionEaseInOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  },

  components: {
    // ─── Button ───────────────────────────────────────────
    Button: {
      // Primary: solid accent-600, no shadow, 40px desktop
      colorPrimary:      "#4338CA",
      colorPrimaryHover: "#362FA0",
      colorPrimaryActive:"#2A2480",
      controlHeight:   40,
      controlHeightSM: 32,
      controlHeightLG: 44,   // 44px mobile
      paddingContentHorizontal: 16,
      paddingContentHorizontalSM: 12,
      fontWeight: 600,
      borderRadius:   8,
      borderRadiusSM: 8,
      borderRadiusLG: 8,
      // Secondary: 1px border, transparent bg
      defaultBorderColor: "#D4D1CB",
      defaultColor: "#3A3F47",
      defaultBg: "transparent",
      defaultHoverBg: "#F4F3F1",
      defaultHoverBorderColor: "#4338CA",
      defaultHoverColor: "#4338CA",
      // No box shadows on buttons
      boxShadow:       "none",
      primaryShadow:   "none",
      dangerShadow:    "none",
    },

    // ─── Card ─────────────────────────────────────────────
    Card: {
      paddingLG:           20,
      padding:             16,
      paddingSM:           12,
      colorBorderSecondary:"#E7E5E1",
      borderRadiusLG:      10,    // max rounded-lg
      boxShadow:           "none",
      headerBg:            "transparent",
    },

    // ─── Table ────────────────────────────────────────────
    Table: {
      fontSize:          13,
      padding:           12,
      paddingXS:          8,
      // Surface-sunken header
      headerBg:          "#F4F3F1",
      headerColor:       "#6B7280",   // ink-500
      headerSplitColor:  "#E7E5E1",
      // No zebra — hairline dividers only
      rowHoverBg:        "#F4F3F1",
      rowExpandedBg:     "#FAFAF9",
      borderColor:       "#E7E5E1",
      borderRadius:      10,
      headerBorderRadius:10,
      cellFontSize:      13,
    },

    // ─── Form ─────────────────────────────────────────────
    Form: {
      itemMarginBottom:  16,
      labelFontSize:     12,
      labelColor:        "#3A3F47",   // ink-700
      labelRequiredMarkColor: "#B3261E",
    },

    // ─── Input ────────────────────────────────────────────
    Input: {
      controlHeight:   40,
      controlHeightSM: 32,
      controlHeightLG: 44,
      borderRadius:    8,
      borderRadiusSM:  8,
      borderRadiusLG:  8,
      colorBorder:     "#E7E5E1",
      hoverBorderColor:"#4338CA",
      activeBorderColor:"#4338CA",
      activeShadow:    "0 0 0 2px #FAFAF9, 0 0 0 4px rgba(67,56,202,0.20)",
      colorBgContainer:"#FFFFFF",
      colorText:       "#12151A",
      colorTextPlaceholder: "#A9AFB8",
      fontSize:        13,
    },

    // ─── Select ───────────────────────────────────────────
    Select: {
      controlHeight:   40,
      controlHeightSM: 32,
      controlHeightLG: 44,
      borderRadius:    8,
      colorBorder:     "#E7E5E1",
      optionSelectedBg:"#EEF0FF",
      optionSelectedColor:"#4338CA",
    },

    // ─── DatePicker ───────────────────────────────────────
    DatePicker: {
      controlHeight:   40,
      controlHeightSM: 32,
      controlHeightLG: 44,
      borderRadius:    8,
      colorBorder:     "#E7E5E1",
      activeShadow:    "0 0 0 2px #FAFAF9, 0 0 0 4px rgba(67,56,202,0.20)",
    },

    // ─── Tag / Badge ──────────────────────────────────────
    Tag: {
      borderRadiusSM:    20,  // pill shape for status chips
      fontSize:          11,
      fontSizeSM:        10,
      lineHeight:        18,
      // Outline + dot style (transparent bg, colored border)
      defaultBg:         "transparent",
      defaultColor:      "#3A3F47",
    },

    // ─── Modal ────────────────────────────────────────────
    Modal: {
      borderRadiusLG:  10,
      headerBg:        "#FFFFFF",
      contentBg:       "#FFFFFF",
      footerBg:        "#FAFAF9",
      titleFontSize:   16,
      titleColor:      "#12151A",
      // hairline border via CSS
      boxShadow:       "0 8px 24px -4px rgba(18,21,26,0.12), 0 4px 10px -4px rgba(18,21,26,0.08)",
    },

    // ─── Drawer ───────────────────────────────────────────
    Drawer: {
      borderRadiusLG: 10,
      colorBgElevated:"#FFFFFF",
    },

    // ─── Tabs ─────────────────────────────────────────────
    Tabs: {
      margin:             0,
      titleFontSize:      13,
      horizontalMargin:   "0 0 16px 0",
      itemColor:          "#6B7280",   // ink-500
      itemSelectedColor:  "#4338CA",   // accent-600
      itemHoverColor:     "#362FA0",   // accent-700
      inkBarColor:        "#4338CA",
      cardBg:             "#F4F3F1",
      cardGutter:          2,
    },

    // ─── Menu (Sidebar) ───────────────────────────────────
    Menu: {
      colorBgContainer:    "#1E1B4B",   // accent-900 dark sidebar
      colorText:           "rgba(255,255,255,0.60)",
      colorTextLightSolid: "#FFFFFF",
      itemColor:           "rgba(255,255,255,0.60)",
      itemHoverColor:      "#FFFFFF",
      itemSelectedColor:   "#FFFFFF",
      itemActiveBg:        "rgba(99,102,241,0.20)",
      itemSelectedBg:      "rgba(99,102,241,0.20)",
      itemHoverBg:         "rgba(255,255,255,0.06)",
      subMenuItemBg:       "transparent",
      groupTitleColor:     "rgba(255,255,255,0.30)",
      groupTitleFontSize:  10,
      iconSize:            16,
      fontSize:            13,
      itemBorderRadius:    6,
    },

    // ─── Notification / Message ───────────────────────────
    Message: {
      contentBg:      "#12151A",   // ink-900 dark toast
      contentPadding: "10px 16px",
      borderRadiusLG: 8,
      boxShadow:      "0 4px 12px -2px rgba(18,21,26,0.16)",
    },

    // ─── Notification ─────────────────────────────────────
    Notification: {
      colorBgElevated: "#FFFFFF",
      borderRadiusLG:  10,
      boxShadow:       "0 4px 12px -2px rgba(18,21,26,0.12)",
      width:           360,
    },

    // ─── Badge ────────────────────────────────────────────
    Badge: {
      fontSize:         10,
      colorBgContainer: "#FAFAF9",
    },

    // ─── Tooltip ──────────────────────────────────────────
    Tooltip: {
      colorBgSpotlight: "#12151A",
      colorTextLightSolid: "#FFFFFF",
      fontSize: 12,
      borderRadius: 6,
    },

    // ─── Pagination ───────────────────────────────────────
    Pagination: {
      itemActiveBg: "#4338CA",
      colorPrimary: "#4338CA",
      borderRadius: 6,
      fontSize: 13,
    },

    // ─── Skeleton ─────────────────────────────────────────
    Skeleton: {
      colorFillContent: "#F4F3F1",
      gradientFromColor: "#F4F3F1",
      gradientToColor:   "#E7E5E1",
      borderRadius: 6,
    },

    // ─── Steps ────────────────────────────────────────────
    Steps: {
      colorPrimary: "#4338CA",
      fontSize: 13,
    },

    // ─── Switch ───────────────────────────────────────────
    Switch: {
      colorPrimary: "#4338CA",
      colorPrimaryHover: "#362FA0",
      handleBg: "#FFFFFF",
    },

    // ─── Checkbox ─────────────────────────────────────────
    Checkbox: {
      colorPrimary: "#4338CA",
      colorPrimaryHover: "#362FA0",
      borderRadius: 4,
    },

    // ─── Radio ────────────────────────────────────────────
    Radio: {
      colorPrimary: "#4338CA",
      colorPrimaryHover: "#362FA0",
    },

    // ─── Divider ──────────────────────────────────────────
    Divider: {
      colorSplit: "#E7E5E1",
      colorText:  "#A9AFB8",
      fontSize:   11,
    },

    // ─── Popover ──────────────────────────────────────────
    Popover: {
      borderRadiusOuter: 10,
      boxShadow: "0 4px 12px -2px rgba(18,21,26,0.12)",
    },

    // ─── Alert ────────────────────────────────────────────
    Alert: {
      borderRadius: 8,
      fontSize: 13,
    },
  },
};
