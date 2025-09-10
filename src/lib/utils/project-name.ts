/**
 * Utilities for extracting and formatting project names from database paths
 */

/**
 * Extracts a project name from a database file path
 * @param databasePath - Full path to the database file
 * @returns Formatted project name or fallback
 */
export function extractProjectName(databasePath: string | null | undefined): string {
	if (!databasePath) {
		return 'No Project';
	}

	// Remove file extension and get basename
	const basename =
		databasePath
			.split(/[/\\]/) // Split on forward or backward slash
			.pop() || databasePath; // Get last segment or fallback to full path

	// Remove common database extensions
	const nameWithoutExt = basename.replace(/\.(db|sqlite|sqlite3)$/i, '');

	// If it's just "lifecycle" or similar generic names, use directory name
	if (nameWithoutExt.toLowerCase() === 'lifecycle') {
		const pathSegments = databasePath.split(/[/\\]/).filter(Boolean);
		if (pathSegments.length > 1) {
			// Use parent directory name
			const parentDir = pathSegments[pathSegments.length - 2];
			return formatProjectName(parentDir);
		}
	}

	return formatProjectName(nameWithoutExt);
}

/**
 * Formats a project name for display
 * @param name - Raw project name
 * @returns Formatted display name
 */
function formatProjectName(name: string): string {
	if (!name || name === '.' || name === '..' || name === '.db') {
		return 'Unnamed Project';
	}

	// Convert common separators to spaces and title case
	return (
		name
			.replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ')
			.trim() || 'Unnamed Project'
	);
}

/**
 * Gets a short display version of the full database path for tooltips
 * @param databasePath - Full path to the database file
 * @returns Shortened path for display
 */
export function getDisplayPath(databasePath: string | null | undefined): string {
	if (!databasePath) return 'No database selected';

	// If path is very long, show .../ prefix
	if (databasePath.length > 50) {
		const segments = databasePath.split(/[/\\]/);
		if (segments.length > 2) {
			return `.../${segments.slice(-2).join('/')}`;
		}
	}

	return databasePath;
}
