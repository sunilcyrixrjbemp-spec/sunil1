/**
 * ============================================================
 * Unified Application Skeleton System (Single Shared Wrapper)
 * Cyrix Field Connect — Frontend Design System
 * ============================================================
 * Standardizes shimmer loaders across the entire application with
 * design system tokens (--surface-sunken #F4F3F1 & white highlight).
 * ============================================================
 */

import React from "react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export function AppSkeletonTheme({ children }: { children: React.ReactNode }) {
  return (
    <SkeletonTheme baseColor="#F4F3F1" highlightColor="#FFFFFF" borderRadius={8}>
      {children}
    </SkeletonTheme>
  );
}

export { Skeleton };
export default Skeleton;
