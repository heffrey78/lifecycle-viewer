/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Custom colors for lifecycle states
				draft: '#ef4444', // red-500
				review: '#f97316', // orange-500
				approved: '#3b82f6', // blue-500
				ready: '#10b981', // emerald-500
				implemented: '#059669', // emerald-600
				validated: '#047857', // emerald-700
				deprecated: '#6b7280', // gray-500

				// Task states
				'not-started': '#ef4444', // red-500
				'in-progress': '#f97316', // orange-500
				blocked: '#991b1b', // red-800
				complete: '#10b981', // emerald-500
				abandoned: '#6b7280', // gray-500

				// Architecture states
				proposed: '#f97316', // orange-500
				accepted: '#10b981', // emerald-500
				rejected: '#ef4444' // red-500
			}
		}
	},
	plugins: [import('@tailwindcss/forms'), import('@tailwindcss/typography')]
};
