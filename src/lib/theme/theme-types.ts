export type RequirementStatus = 'Draft' | 'Under Review' | 'Approved' | 'Architecture' | 'Ready' | 'Implemented' | 'Validated' | 'Deprecated';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Complete' | 'Abandoned';
export type ArchitectureStatus = 'Draft' | 'Under Review' | 'Approved' | 'Proposed' | 'Accepted' | 'Rejected' | 'Deprecated' | 'Superseded' | 'Implemented';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type EffortSize = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type RiskLevel = 'High' | 'Medium' | 'Low';

export interface ColorVariant {
  background: string;
  text: string;
  border: string;
  hover?: string;
}

export interface StatusColors {
  [key: string]: ColorVariant;
}

export interface SemanticColors {
  primary: ColorVariant;
  secondary: ColorVariant;
  success: ColorVariant;
  warning: ColorVariant;
  error: ColorVariant;
  info: ColorVariant;
  card: ColorVariant;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  
  // Status color mappings
  requirementStatus: StatusColors;
  taskStatus: StatusColors;
  architectureStatus: StatusColors;
  
  // Priority, effort, and risk mappings
  priority: StatusColors;
  effort: StatusColors;
  risk: StatusColors;
  
  // Semantic color system
  semantic: SemanticColors;
  
  // Base color system
  base: {
    background: string;
    foreground: string;
    muted: string;
    accent: string;
    border: string;
  };
}

export interface ThemeContextValue {
  currentTheme: Theme;
  availableThemes: Theme[];
  setTheme: (themeId: string) => void;
}