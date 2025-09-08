import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { Theme, ThemeContextValue } from './theme-types.js';
import { defaultThemes } from './default-themes.js';

const THEME_STORAGE_KEY = 'lifecycle-viewer-theme';

function createThemeStore(): Writable<Theme> {
  let initialTheme = defaultThemes.light;
  
  if (browser) {
    const storedThemeId = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedThemeId) {
      const foundTheme = Object.values(defaultThemes).find(theme => theme.id === storedThemeId);
      if (foundTheme) {
        initialTheme = foundTheme;
      }
    }
  }
  
  const { subscribe, set, update } = writable<Theme>(initialTheme);
  
  return {
    subscribe,
    set: (theme: Theme) => {
      if (browser) {
        localStorage.setItem(THEME_STORAGE_KEY, theme.id);
        applyThemeToDOM(theme);
      }
      set(theme);
    },
    update
  };
}

function applyThemeToDOM(theme: Theme) {
  if (!browser) return;
  
  const root = document.documentElement;
  
  // Apply base colors as CSS custom properties
  root.style.setProperty('--color-background', theme.base.background);
  root.style.setProperty('--color-foreground', theme.base.foreground);
  root.style.setProperty('--color-muted', theme.base.muted);
  root.style.setProperty('--color-accent', theme.base.accent);
  root.style.setProperty('--color-border', theme.base.border);
  
  // Apply semantic card colors - extract from Tailwind classes to CSS values
  const colorMap: Record<string, string> = {
    'bg-white': '#ffffff',
    'bg-gray-100': '#f3f4f6',
    'bg-gray-800': '#1f2937',
    'bg-gray-900': '#111827',
    'text-gray-900': '#111827',
    'text-gray-100': '#f3f4f6',
    'text-white': '#ffffff',
    'border-gray-200': '#e5e7eb',
    'border-gray-700': '#374151',
    'border-gray-600': '#4b5563'
  };
  
  const cardBg = colorMap[theme.semantic.card.background] || theme.base.background;
  const cardText = colorMap[theme.semantic.card.text] || theme.base.foreground;
  const cardBorder = colorMap[theme.semantic.card.border] || theme.base.border;
  
  root.style.setProperty('--color-card-bg', cardBg);
  root.style.setProperty('--color-card-text', cardText);
  root.style.setProperty('--color-card-border', cardBorder);
  
  // Additional color properties for interactive states and hover
  const hoverBg = theme.id === 'light' ? 'rgba(156, 163, 175, 0.1)' : 
                  theme.id === 'dark' ? 'rgba(75, 85, 99, 0.3)' : 
                  'rgba(163, 163, 163, 0.2)'; // high-contrast
                  
  root.style.setProperty('--color-hover-bg', hoverBg);
  root.style.setProperty('--color-warning', theme.id === 'high-contrast' ? '#fb923c' : '#ea580c');
  root.style.setProperty('--color-error', theme.id === 'high-contrast' ? '#f87171' : '#dc2626');
  root.style.setProperty('--color-success', theme.id === 'high-contrast' ? '#34d399' : '#059669');
  
  // Secondary background for badges and subtle elements (like requirement type)
  const secondaryBg = theme.id === 'light' ? '#f3f4f6' :        // gray-100 for light
                      theme.id === 'dark' ? '#374151' :          // gray-700 for dark  
                      '#4b5563';                                  // gray-600 for high-contrast
  root.style.setProperty('--color-secondary-bg', secondaryBg);
  
  // Secondary hover background for badge hover states
  const secondaryHoverBg = theme.id === 'light' ? '#e5e7eb' :    // gray-200 for light
                           theme.id === 'dark' ? '#4b5563' :      // gray-600 for dark
                           '#6b7280';                              // gray-500 for high-contrast  
  root.style.setProperty('--color-secondary-hover-bg', secondaryHoverBg);
  
  // Special handling for high contrast theme text contrast
  if (theme.id === 'high-contrast') {
    root.style.setProperty('--color-card-bg-contrast', '#000000'); // Black text instead of white
    root.style.setProperty('--color-contrast-text', '#000000'); // Black text for better contrast
  } else {
    root.style.setProperty('--color-card-bg-contrast', '#ffffff');
    root.style.setProperty('--color-contrast-text', '#ffffff');
  }
}

export const currentTheme = createThemeStore();

export function setTheme(themeId: string): void {
  const theme = Object.values(defaultThemes).find(t => t.id === themeId);
  if (theme) {
    currentTheme.set(theme);
  }
}

export function getThemeContext(): ThemeContextValue {
  let theme: Theme;
  const unsubscribe = currentTheme.subscribe(t => theme = t);
  unsubscribe();
  
  return {
    currentTheme: theme!,
    availableThemes: Object.values(defaultThemes),
    setTheme
  };
}

// Initialize theme on first load
if (browser) {
  currentTheme.subscribe(theme => {
    applyThemeToDOM(theme);
  });
}