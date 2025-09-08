import { describe, it, expect } from 'vitest';
import { extractProjectName, getDisplayPath } from './project-name.js';

describe('project-name utilities', () => {
	describe('extractProjectName', () => {
		it('should handle null and undefined paths', () => {
			expect(extractProjectName(null)).toBe('No Project');
			expect(extractProjectName(undefined)).toBe('No Project');
			expect(extractProjectName('')).toBe('No Project');
		});

		it('should extract project name from simple database filename', () => {
			expect(extractProjectName('my-project.db')).toBe('My Project');
			expect(extractProjectName('awesome_app.sqlite')).toBe('Awesome App');
			expect(extractProjectName('test-database.sqlite3')).toBe('Test Database');
		});

		it('should handle full file paths', () => {
			expect(extractProjectName('/home/user/projects/my-app/data.db')).toBe('Data');
			expect(extractProjectName('/Users/developer/work/client-project/lifecycle.db')).toBe(
				'Client Project'
			);
			expect(extractProjectName('C:\\Projects\\MyApp\\database.sqlite')).toBe('Database');
		});

		it('should use parent directory name for generic database names', () => {
			expect(extractProjectName('/projects/awesome-app/lifecycle.db')).toBe('Awesome App');
			expect(extractProjectName('/home/user/my_project/lifecycle.sqlite')).toBe('My Project');
			expect(extractProjectName('C:\\Work\\ClientWork\\lifecycle.db')).toBe('Clientwork');
		});

		it('should handle filenames without extensions', () => {
			expect(extractProjectName('my-project')).toBe('My Project');
			expect(extractProjectName('/path/to/awesome_database')).toBe('Awesome Database');
		});

		it('should format names with dashes and underscores', () => {
			expect(extractProjectName('my-awesome-project.db')).toBe('My Awesome Project');
			expect(extractProjectName('test_database_v2.sqlite')).toBe('Test Database V2');
			expect(extractProjectName('mixed-format_name.db')).toBe('Mixed Format Name');
		});

		it('should handle edge cases', () => {
			expect(extractProjectName('.')).toBe('Unnamed Project');
			expect(extractProjectName('..')).toBe('Unnamed Project');
			expect(extractProjectName('.db')).toBe('Unnamed Project');
			expect(extractProjectName('/.db')).toBe('Unnamed Project');
		});

		it('should preserve proper capitalization in acronyms', () => {
			expect(extractProjectName('my-API-project.db')).toBe('My Api Project');
			expect(extractProjectName('SQL_database.db')).toBe('Sql Database');
		});
	});

	describe('getDisplayPath', () => {
		it('should handle null and undefined paths', () => {
			expect(getDisplayPath(null)).toBe('No database selected');
			expect(getDisplayPath(undefined)).toBe('No database selected');
			expect(getDisplayPath('')).toBe('No database selected');
		});

		it('should return short paths as-is', () => {
			const shortPath = '/home/user/project.db';
			expect(getDisplayPath(shortPath)).toBe(shortPath);
		});

		it('should truncate very long paths', () => {
			const longPath =
				'/very/long/path/that/goes/on/and/on/with/many/nested/directories/project.db';
			const result = getDisplayPath(longPath);
			expect(result).toMatch(/^\.\.\.\/.*\/project\.db$/);
			expect(result.length).toBeLessThan(longPath.length);
		});

		it('should preserve last two segments for long paths', () => {
			const longPath =
				'/very/long/path/that/goes/on/and/on/with/many/nested/final-dir/project.db';
			const result = getDisplayPath(longPath);
			expect(result).toBe('.../final-dir/project.db');
		});

		it('should handle Windows paths', () => {
			const winPath = 'C:\\Very\\Long\\Path\\With\\Many\\Directories\\ProjectName\\database.db';
			const result = getDisplayPath(winPath);
			expect(result).toBe('.../ProjectName/database.db');
		});

		it('should not truncate medium-length paths', () => {
			const mediumPath = '/home/user/projects/my-app/data.db';
			expect(getDisplayPath(mediumPath)).toBe(mediumPath);
		});
	});

	describe('integration scenarios', () => {
		it('should work with realistic database paths', () => {
			const testCases = [
				{
					path: '/home/developer/projects/e-commerce-app/lifecycle.db',
					expectedName: 'E Commerce App',
					expectedDisplay: '.../e-commerce-app/lifecycle.db'
				},
				{
					path: 'C:\\Users\\John\\Documents\\Projects\\inventory-system\\data.sqlite',
					expectedName: 'Data',
					expectedDisplay: '.../inventory-system/data.sqlite'
				},
				{
					path: './local-project.db',
					expectedName: 'Local Project',
					expectedDisplay: './local-project.db'
				}
			];

			testCases.forEach(({ path, expectedName, expectedDisplay }) => {
				expect(extractProjectName(path)).toBe(expectedName);
				expect(getDisplayPath(path)).toBe(expectedDisplay);
			});
		});
	});
});