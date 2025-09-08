import type { Theme } from './theme-types.js';

const lightTheme: Theme = {
  id: 'light',
  name: 'Light',
  description: 'Default light theme',
  
  requirementStatus: {
    'Draft': {
      background: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-300',
      hover: 'hover:bg-red-200'
    },
    'Under Review': {
      background: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-300',
      hover: 'hover:bg-orange-200'
    },
    'Approved': {
      background: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-300',
      hover: 'hover:bg-blue-200'
    },
    'Architecture': {
      background: 'bg-purple-100',
      text: 'text-purple-800',
      border: 'border-purple-300',
      hover: 'hover:bg-purple-200'
    },
    'Ready': {
      background: 'bg-emerald-100',
      text: 'text-emerald-800',
      border: 'border-emerald-300',
      hover: 'hover:bg-emerald-200'
    },
    'Implemented': {
      background: 'bg-emerald-200',
      text: 'text-emerald-900',
      border: 'border-emerald-400',
      hover: 'hover:bg-emerald-300'
    },
    'Validated': {
      background: 'bg-emerald-300',
      text: 'text-emerald-900',
      border: 'border-emerald-500',
      hover: 'hover:bg-emerald-400'
    },
    'Deprecated': {
      background: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300',
      hover: 'hover:bg-gray-200'
    }
  },
  
  taskStatus: {
    'Not Started': {
      background: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-300',
      hover: 'hover:bg-red-200'
    },
    'In Progress': {
      background: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-300',
      hover: 'hover:bg-orange-200'
    },
    'Blocked': {
      background: 'bg-red-200',
      text: 'text-red-900',
      border: 'border-red-400',
      hover: 'hover:bg-red-300'
    },
    'Complete': {
      background: 'bg-emerald-100',
      text: 'text-emerald-800',
      border: 'border-emerald-300',
      hover: 'hover:bg-emerald-200'
    },
    'Abandoned': {
      background: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300',
      hover: 'hover:bg-gray-200'
    }
  },
  
  architectureStatus: {
    'Draft': {
      background: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300',
      hover: 'hover:bg-gray-200'
    },
    'Under Review': {
      background: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-300',
      hover: 'hover:bg-orange-200'
    },
    'Approved': {
      background: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-300',
      hover: 'hover:bg-blue-200'
    },
    'Proposed': {
      background: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-300',
      hover: 'hover:bg-orange-200'
    },
    'Accepted': {
      background: 'bg-emerald-100',
      text: 'text-emerald-800',
      border: 'border-emerald-300',
      hover: 'hover:bg-emerald-200'
    },
    'Rejected': {
      background: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-300',
      hover: 'hover:bg-red-200'
    },
    'Deprecated': {
      background: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300',
      hover: 'hover:bg-gray-200'
    },
    'Superseded': {
      background: 'bg-gray-200',
      text: 'text-gray-900',
      border: 'border-gray-400',
      hover: 'hover:bg-gray-300'
    },
    'Implemented': {
      background: 'bg-emerald-200',
      text: 'text-emerald-900',
      border: 'border-emerald-400',
      hover: 'hover:bg-emerald-300'
    }
  },
  
  priority: {
    'P0': {
      background: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-300',
      hover: 'hover:bg-red-200'
    },
    'P1': {
      background: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-300',
      hover: 'hover:bg-orange-200'
    },
    'P2': {
      background: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-300',
      hover: 'hover:bg-blue-200'
    },
    'P3': {
      background: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300',
      hover: 'hover:bg-gray-200'
    }
  },
  
  effort: {
    'XS': {
      background: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-300',
      hover: 'hover:bg-green-200'
    },
    'S': {
      background: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-300',
      hover: 'hover:bg-blue-200'
    },
    'M': {
      background: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-300',
      hover: 'hover:bg-yellow-200'
    },
    'L': {
      background: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-300',
      hover: 'hover:bg-orange-200'
    },
    'XL': {
      background: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-300',
      hover: 'hover:bg-red-200'
    }
  },
  
  risk: {
    'High': {
      background: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-300',
      hover: 'hover:bg-red-200'
    },
    'Medium': {
      background: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-300',
      hover: 'hover:bg-orange-200'
    },
    'Low': {
      background: 'bg-emerald-100',
      text: 'text-emerald-800',
      border: 'border-emerald-300',
      hover: 'hover:bg-emerald-200'
    }
  },
  
  semantic: {
    primary: {
      background: 'bg-blue-500',
      text: 'text-white',
      border: 'border-blue-500',
      hover: 'hover:bg-blue-600'
    },
    secondary: {
      background: 'bg-gray-500',
      text: 'text-white',
      border: 'border-gray-500',
      hover: 'hover:bg-gray-600'
    },
    success: {
      background: 'bg-emerald-500',
      text: 'text-white',
      border: 'border-emerald-500',
      hover: 'hover:bg-emerald-600'
    },
    warning: {
      background: 'bg-orange-500',
      text: 'text-white',
      border: 'border-orange-500',
      hover: 'hover:bg-orange-600'
    },
    error: {
      background: 'bg-red-500',
      text: 'text-white',
      border: 'border-red-500',
      hover: 'hover:bg-red-600'
    },
    info: {
      background: 'bg-blue-500',
      text: 'text-white',
      border: 'border-blue-500',
      hover: 'hover:bg-blue-600'
    },
    card: {
      background: 'bg-white',
      text: 'text-gray-900',
      border: 'border-gray-200',
      hover: 'hover:bg-gray-50'
    }
  },
  
  base: {
    background: '#ffffff',
    foreground: '#1f2937',
    muted: '#6b7280',
    accent: '#3b82f6',
    border: '#e5e7eb'
  }
};

const darkTheme: Theme = {
  id: 'dark',
  name: 'Dark',
  description: 'Dark theme with high contrast',
  
  requirementStatus: {
    'Draft': {
      background: 'bg-red-900',
      text: 'text-red-200',
      border: 'border-red-700',
      hover: 'hover:bg-red-800'
    },
    'Under Review': {
      background: 'bg-orange-900',
      text: 'text-orange-200',
      border: 'border-orange-700',
      hover: 'hover:bg-orange-800'
    },
    'Approved': {
      background: 'bg-blue-900',
      text: 'text-blue-200',
      border: 'border-blue-700',
      hover: 'hover:bg-blue-800'
    },
    'Architecture': {
      background: 'bg-purple-900',
      text: 'text-purple-200',
      border: 'border-purple-700',
      hover: 'hover:bg-purple-800'
    },
    'Ready': {
      background: 'bg-emerald-900',
      text: 'text-emerald-200',
      border: 'border-emerald-700',
      hover: 'hover:bg-emerald-800'
    },
    'Implemented': {
      background: 'bg-emerald-800',
      text: 'text-emerald-100',
      border: 'border-emerald-600',
      hover: 'hover:bg-emerald-700'
    },
    'Validated': {
      background: 'bg-emerald-700',
      text: 'text-emerald-100',
      border: 'border-emerald-500',
      hover: 'hover:bg-emerald-600'
    },
    'Deprecated': {
      background: 'bg-gray-800',
      text: 'text-gray-300',
      border: 'border-gray-600',
      hover: 'hover:bg-gray-700'
    }
  },
  
  taskStatus: {
    'Not Started': {
      background: 'bg-red-900',
      text: 'text-red-200',
      border: 'border-red-700',
      hover: 'hover:bg-red-800'
    },
    'In Progress': {
      background: 'bg-orange-900',
      text: 'text-orange-200',
      border: 'border-orange-700',
      hover: 'hover:bg-orange-800'
    },
    'Blocked': {
      background: 'bg-red-800',
      text: 'text-red-100',
      border: 'border-red-600',
      hover: 'hover:bg-red-700'
    },
    'Complete': {
      background: 'bg-emerald-900',
      text: 'text-emerald-200',
      border: 'border-emerald-700',
      hover: 'hover:bg-emerald-800'
    },
    'Abandoned': {
      background: 'bg-gray-800',
      text: 'text-gray-300',
      border: 'border-gray-600',
      hover: 'hover:bg-gray-700'
    }
  },
  
  architectureStatus: {
    'Draft': {
      background: 'bg-gray-800',
      text: 'text-gray-300',
      border: 'border-gray-600',
      hover: 'hover:bg-gray-700'
    },
    'Under Review': {
      background: 'bg-orange-900',
      text: 'text-orange-200',
      border: 'border-orange-700',
      hover: 'hover:bg-orange-800'
    },
    'Approved': {
      background: 'bg-blue-900',
      text: 'text-blue-200',
      border: 'border-blue-700',
      hover: 'hover:bg-blue-800'
    },
    'Proposed': {
      background: 'bg-orange-900',
      text: 'text-orange-200',
      border: 'border-orange-700',
      hover: 'hover:bg-orange-800'
    },
    'Accepted': {
      background: 'bg-emerald-900',
      text: 'text-emerald-200',
      border: 'border-emerald-700',
      hover: 'hover:bg-emerald-800'
    },
    'Rejected': {
      background: 'bg-red-900',
      text: 'text-red-200',
      border: 'border-red-700',
      hover: 'hover:bg-red-800'
    },
    'Deprecated': {
      background: 'bg-gray-800',
      text: 'text-gray-300',
      border: 'border-gray-600',
      hover: 'hover:bg-gray-700'
    },
    'Superseded': {
      background: 'bg-gray-700',
      text: 'text-gray-200',
      border: 'border-gray-500',
      hover: 'hover:bg-gray-600'
    },
    'Implemented': {
      background: 'bg-emerald-800',
      text: 'text-emerald-100',
      border: 'border-emerald-600',
      hover: 'hover:bg-emerald-700'
    }
  },
  
  priority: {
    'P0': {
      background: 'bg-red-900',
      text: 'text-red-200',
      border: 'border-red-700',
      hover: 'hover:bg-red-800'
    },
    'P1': {
      background: 'bg-orange-900',
      text: 'text-orange-200',
      border: 'border-orange-700',
      hover: 'hover:bg-orange-800'
    },
    'P2': {
      background: 'bg-blue-900',
      text: 'text-blue-200',
      border: 'border-blue-700',
      hover: 'hover:bg-blue-800'
    },
    'P3': {
      background: 'bg-gray-800',
      text: 'text-gray-300',
      border: 'border-gray-600',
      hover: 'hover:bg-gray-700'
    }
  },
  
  effort: {
    'XS': {
      background: 'bg-green-900',
      text: 'text-green-200',
      border: 'border-green-700',
      hover: 'hover:bg-green-800'
    },
    'S': {
      background: 'bg-blue-900',
      text: 'text-blue-200',
      border: 'border-blue-700',
      hover: 'hover:bg-blue-800'
    },
    'M': {
      background: 'bg-yellow-900',
      text: 'text-yellow-200',
      border: 'border-yellow-700',
      hover: 'hover:bg-yellow-800'
    },
    'L': {
      background: 'bg-orange-900',
      text: 'text-orange-200',
      border: 'border-orange-700',
      hover: 'hover:bg-orange-800'
    },
    'XL': {
      background: 'bg-red-900',
      text: 'text-red-200',
      border: 'border-red-700',
      hover: 'hover:bg-red-800'
    }
  },
  
  risk: {
    'High': {
      background: 'bg-red-900',
      text: 'text-red-200',
      border: 'border-red-700',
      hover: 'hover:bg-red-800'
    },
    'Medium': {
      background: 'bg-orange-900',
      text: 'text-orange-200',
      border: 'border-orange-700',
      hover: 'hover:bg-orange-800'
    },
    'Low': {
      background: 'bg-emerald-900',
      text: 'text-emerald-200',
      border: 'border-emerald-700',
      hover: 'hover:bg-emerald-800'
    }
  },
  
  semantic: {
    primary: {
      background: 'bg-blue-600',
      text: 'text-white',
      border: 'border-blue-600',
      hover: 'hover:bg-blue-700'
    },
    secondary: {
      background: 'bg-gray-600',
      text: 'text-white',
      border: 'border-gray-600',
      hover: 'hover:bg-gray-700'
    },
    success: {
      background: 'bg-emerald-600',
      text: 'text-white',
      border: 'border-emerald-600',
      hover: 'hover:bg-emerald-700'
    },
    warning: {
      background: 'bg-orange-600',
      text: 'text-white',
      border: 'border-orange-600',
      hover: 'hover:bg-orange-700'
    },
    error: {
      background: 'bg-red-600',
      text: 'text-white',
      border: 'border-red-600',
      hover: 'hover:bg-red-700'
    },
    info: {
      background: 'bg-blue-600',
      text: 'text-white',
      border: 'border-blue-600',
      hover: 'hover:bg-blue-700'
    },
    card: {
      background: 'bg-gray-800',
      text: 'text-gray-100',
      border: 'border-gray-700',
      hover: 'hover:bg-gray-750'
    }
  },
  
  base: {
    background: '#111827',
    foreground: '#f9fafb',
    muted: '#9ca3af',
    accent: '#60a5fa',
    border: '#374151'
  }
};

const highContrastTheme: Theme = {
  id: 'high-contrast',
  name: 'High Contrast',
  description: 'High contrast theme for accessibility',
  
  requirementStatus: {
    'Draft': {
      background: 'bg-black',
      text: 'text-red-400',
      border: 'border-red-400',
      hover: 'hover:bg-gray-900'
    },
    'Under Review': {
      background: 'bg-black',
      text: 'text-orange-400',
      border: 'border-orange-400',
      hover: 'hover:bg-gray-900'
    },
    'Approved': {
      background: 'bg-black',
      text: 'text-blue-400',
      border: 'border-blue-400',
      hover: 'hover:bg-gray-900'
    },
    'Architecture': {
      background: 'bg-black',
      text: 'text-purple-400',
      border: 'border-purple-400',
      hover: 'hover:bg-gray-900'
    },
    'Ready': {
      background: 'bg-black',
      text: 'text-green-400',
      border: 'border-green-400',
      hover: 'hover:bg-gray-900'
    },
    'Implemented': {
      background: 'bg-green-900',
      text: 'text-white',
      border: 'border-green-400',
      hover: 'hover:bg-green-800'
    },
    'Validated': {
      background: 'bg-green-800',
      text: 'text-white',
      border: 'border-green-300',
      hover: 'hover:bg-green-700'
    },
    'Deprecated': {
      background: 'bg-black',
      text: 'text-gray-400',
      border: 'border-gray-400',
      hover: 'hover:bg-gray-900'
    }
  },
  
  taskStatus: {
    'Not Started': {
      background: 'bg-black',
      text: 'text-red-400',
      border: 'border-red-400',
      hover: 'hover:bg-gray-900'
    },
    'In Progress': {
      background: 'bg-black',
      text: 'text-orange-400',
      border: 'border-orange-400',
      hover: 'hover:bg-gray-900'
    },
    'Blocked': {
      background: 'bg-red-900',
      text: 'text-white',
      border: 'border-red-400',
      hover: 'hover:bg-red-800'
    },
    'Complete': {
      background: 'bg-black',
      text: 'text-green-400',
      border: 'border-green-400',
      hover: 'hover:bg-gray-900'
    },
    'Abandoned': {
      background: 'bg-black',
      text: 'text-gray-400',
      border: 'border-gray-400',
      hover: 'hover:bg-gray-900'
    }
  },
  
  architectureStatus: {
    'Draft': {
      background: 'bg-black',
      text: 'text-gray-400',
      border: 'border-gray-400',
      hover: 'hover:bg-gray-900'
    },
    'Under Review': {
      background: 'bg-black',
      text: 'text-orange-400',
      border: 'border-orange-400',
      hover: 'hover:bg-gray-900'
    },
    'Approved': {
      background: 'bg-black',
      text: 'text-blue-400',
      border: 'border-blue-400',
      hover: 'hover:bg-gray-900'
    },
    'Proposed': {
      background: 'bg-black',
      text: 'text-orange-400',
      border: 'border-orange-400',
      hover: 'hover:bg-gray-900'
    },
    'Accepted': {
      background: 'bg-black',
      text: 'text-green-400',
      border: 'border-green-400',
      hover: 'hover:bg-gray-900'
    },
    'Rejected': {
      background: 'bg-black',
      text: 'text-red-400',
      border: 'border-red-400',
      hover: 'hover:bg-gray-900'
    },
    'Deprecated': {
      background: 'bg-black',
      text: 'text-gray-400',
      border: 'border-gray-400',
      hover: 'hover:bg-gray-900'
    },
    'Superseded': {
      background: 'bg-gray-900',
      text: 'text-white',
      border: 'border-gray-400',
      hover: 'hover:bg-gray-800'
    },
    'Implemented': {
      background: 'bg-green-900',
      text: 'text-white',
      border: 'border-green-400',
      hover: 'hover:bg-green-800'
    }
  },
  
  priority: {
    'P0': {
      background: 'bg-black',
      text: 'text-red-400',
      border: 'border-red-400',
      hover: 'hover:bg-gray-900'
    },
    'P1': {
      background: 'bg-black',
      text: 'text-orange-400',
      border: 'border-orange-400',
      hover: 'hover:bg-gray-900'
    },
    'P2': {
      background: 'bg-black',
      text: 'text-blue-400',
      border: 'border-blue-400',
      hover: 'hover:bg-gray-900'
    },
    'P3': {
      background: 'bg-black',
      text: 'text-gray-400',
      border: 'border-gray-400',
      hover: 'hover:bg-gray-900'
    }
  },
  
  effort: {
    'XS': {
      background: 'bg-black',
      text: 'text-green-400',
      border: 'border-green-400',
      hover: 'hover:bg-gray-900'
    },
    'S': {
      background: 'bg-black',
      text: 'text-blue-400',
      border: 'border-blue-400',
      hover: 'hover:bg-gray-900'
    },
    'M': {
      background: 'bg-black',
      text: 'text-yellow-400',
      border: 'border-yellow-400',
      hover: 'hover:bg-gray-900'
    },
    'L': {
      background: 'bg-black',
      text: 'text-orange-400',
      border: 'border-orange-400',
      hover: 'hover:bg-gray-900'
    },
    'XL': {
      background: 'bg-black',
      text: 'text-red-400',
      border: 'border-red-400',
      hover: 'hover:bg-gray-900'
    }
  },
  
  risk: {
    'High': {
      background: 'bg-black',
      text: 'text-red-400',
      border: 'border-red-400',
      hover: 'hover:bg-gray-900'
    },
    'Medium': {
      background: 'bg-black',
      text: 'text-orange-400',
      border: 'border-orange-400',
      hover: 'hover:bg-gray-900'
    },
    'Low': {
      background: 'bg-black',
      text: 'text-green-400',
      border: 'border-green-400',
      hover: 'hover:bg-gray-900'
    }
  },
  
  semantic: {
    primary: {
      background: 'bg-white',
      text: 'text-black',
      border: 'border-white',
      hover: 'hover:bg-gray-200'
    },
    secondary: {
      background: 'bg-gray-800',
      text: 'text-white',
      border: 'border-gray-800',
      hover: 'hover:bg-gray-700'
    },
    success: {
      background: 'bg-green-600',
      text: 'text-white',
      border: 'border-green-600',
      hover: 'hover:bg-green-700'
    },
    warning: {
      background: 'bg-orange-600',
      text: 'text-black',
      border: 'border-orange-600',
      hover: 'hover:bg-orange-700'
    },
    error: {
      background: 'bg-red-600',
      text: 'text-white',
      border: 'border-red-600',
      hover: 'hover:bg-red-700'
    },
    info: {
      background: 'bg-blue-600',
      text: 'text-white',
      border: 'border-blue-600',
      hover: 'hover:bg-blue-700'
    },
    card: {
      background: 'bg-gray-900',
      text: 'text-white',
      border: 'border-gray-600',
      hover: 'hover:bg-gray-850'
    }
  },
  
  base: {
    background: '#000000',
    foreground: '#ffffff',
    muted: '#a3a3a3',
    accent: '#ffffff',
    border: '#525252'
  }
};

export const defaultThemes = {
  light: lightTheme,
  dark: darkTheme,
  'high-contrast': highContrastTheme
} as const;