import type {
	Theme,
	RequirementStatus,
	TaskStatus,
	ArchitectureStatus,
	Priority,
	EffortSize,
	RiskLevel,
	ColorVariant
} from './theme-types.js';

export function getStatusColors(status: RequirementStatus, theme: Theme): ColorVariant {
	return theme.requirementStatus[status] || theme.requirementStatus['Draft'];
}

export function getTaskStatusColors(status: TaskStatus, theme: Theme): ColorVariant {
	return theme.taskStatus[status] || theme.taskStatus['Not Started'];
}

export function getArchitectureStatusColors(
	status: ArchitectureStatus,
	theme: Theme
): ColorVariant {
	return theme.architectureStatus[status] || theme.architectureStatus['Draft'];
}

export function getPriorityColors(priority: Priority, theme: Theme): ColorVariant {
	return theme.priority[priority] || theme.priority['P3'];
}

export function getEffortColors(effort: EffortSize, theme: Theme): ColorVariant {
	return theme.effort[effort] || theme.effort['M'];
}

export function getRiskColors(risk: RiskLevel, theme: Theme): ColorVariant {
	return theme.risk[risk] || theme.risk['Medium'];
}

export function getStatusColorClasses(status: RequirementStatus, theme: Theme): string {
	const colors = getStatusColors(status, theme);
	return `${colors.background} ${colors.text} ${colors.border}`;
}

export function getTaskStatusColorClasses(status: TaskStatus, theme: Theme): string {
	const colors = getTaskStatusColors(status, theme);
	return `${colors.background} ${colors.text} ${colors.border}`;
}

export function getArchitectureStatusColorClasses(
	status: ArchitectureStatus,
	theme: Theme
): string {
	const colors = getArchitectureStatusColors(status, theme);
	return `${colors.background} ${colors.text} ${colors.border}`;
}

export function getPriorityColorClasses(priority: Priority, theme: Theme): string {
	const colors = getPriorityColors(priority, theme);
	return `${colors.background} ${colors.text} ${colors.border}`;
}

export function getEffortColorClasses(effort: EffortSize, theme: Theme): string {
	const colors = getEffortColors(effort, theme);
	return `${colors.background} ${colors.text} ${colors.border}`;
}

export function getRiskColorClasses(risk: RiskLevel, theme: Theme): string {
	const colors = getRiskColors(risk, theme);
	return `${colors.background} ${colors.text} ${colors.border}`;
}

// Utility functions for interactive states
export function getStatusHoverClasses(status: RequirementStatus, theme: Theme): string {
	const colors = getStatusColors(status, theme);
	return colors.hover || '';
}

export function getTaskStatusHoverClasses(status: TaskStatus, theme: Theme): string {
	const colors = getTaskStatusColors(status, theme);
	return colors.hover || '';
}

export function getArchitectureStatusHoverClasses(
	status: ArchitectureStatus,
	theme: Theme
): string {
	const colors = getArchitectureStatusColors(status, theme);
	return colors.hover || '';
}

export function getPriorityHoverClasses(priority: Priority, theme: Theme): string {
	const colors = getPriorityColors(priority, theme);
	return colors.hover || '';
}

export function getEffortHoverClasses(effort: EffortSize, theme: Theme): string {
	const colors = getEffortColors(effort, theme);
	return colors.hover || '';
}
