import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseService } from './database-service.js';
import type { ProtocolHandler } from './protocol-handler.js';
import type { MCPResponse } from '$lib/types/lifecycle.js';

// Mock ProtocolHandler
class MockProtocolHandler {
	sendRequest = vi.fn();

	mockSuccess(data: any): void {
		this.sendRequest.mockResolvedValue(data);
	}

	mockError(error: Error): void {
		this.sendRequest.mockRejectedValue(error);
	}

	reset(): void {
		this.sendRequest.mockReset();
	}
}

describe('DatabaseService', () => {
	let databaseService: DatabaseService;
	let mockProtocolHandler: MockProtocolHandler;

	beforeEach(() => {
		mockProtocolHandler = new MockProtocolHandler();
		databaseService = new DatabaseService(mockProtocolHandler as any as ProtocolHandler);
		
		// Mock console methods to avoid noise in test output
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	describe('switchDatabase', () => {
		it('should call database/switch with database path', async () => {
			const databasePath = '/path/to/project.db';
			const mockResponse = { success: true };
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.switchDatabase(databasePath);

			expect(mockProtocolHandler.sendRequest).toHaveBeenCalledWith(
				'database/switch',
				{ database: databasePath }
			);
			expect(result).toEqual({
				success: true,
				data: undefined
			});
		});

		it('should handle successful database switch with object response', async () => {
			const databasePath = '/path/to/new.db';
			const mockResponse = { 
				success: true, 
				message: 'Database switched successfully',
				previous_database: '/path/to/old.db'
			};
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.switchDatabase(databasePath);

			expect(result).toEqual({
				success: true,
				data: undefined
			});
		});

		it('should handle database switch failure', async () => {
			const databasePath = '/invalid/path.db';
			const mockResponse = null; // Indicates failure
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.switchDatabase(databasePath);

			expect(result).toEqual({
				success: false,
				error: 'Database switch failed'
			});
		});

		it('should handle database switch with custom error response', async () => {
			const databasePath = '/readonly/database.db';
			const mockResponse = 'Permission denied';
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.switchDatabase(databasePath);

			expect(result).toEqual({
				success: false,
				error: 'Permission denied'
			});
		});

		it('should handle protocol handler exceptions', async () => {
			const databasePath = '/path/to/db.db';
			mockProtocolHandler.mockError(new Error('Network connection failed'));

			const result = await databaseService.switchDatabase(databasePath);

			expect(result).toEqual({
				success: false,
				error: 'Network connection failed'
			});
			expect(console.error).toHaveBeenCalledWith(
				'Database switch error:',
				expect.any(Error)
			);
		});

		it('should handle non-Error exceptions', async () => {
			const databasePath = '/path/to/db.db';
			mockProtocolHandler.mockError('String error' as any);

			const result = await databaseService.switchDatabase(databasePath);

			expect(result).toEqual({
				success: false,
				error: 'String error'
			});
		});

		it('should handle empty database path', async () => {
			const mockResponse = { success: true };
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.switchDatabase('');

			expect(mockProtocolHandler.sendRequest).toHaveBeenCalledWith(
				'database/switch',
				{ database: '' }
			);
		});

		it('should handle database path with spaces', async () => {
			const databasePath = '/path with spaces/my database.db';
			const mockResponse = { success: true };
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.switchDatabase(databasePath);

			expect(mockProtocolHandler.sendRequest).toHaveBeenCalledWith(
				'database/switch',
				{ database: databasePath }
			);
			expect(result.success).toBe(true);
		});

		it('should extract data from MCP response format', async () => {
			const databasePath = '/path/to/db.db';
			const mcpResponse = {
				content: [{
					text: JSON.stringify({ success: true, database_switched: true })
				}]
			};
			mockProtocolHandler.mockSuccess(mcpResponse);

			const result = await databaseService.switchDatabase(databasePath);

			expect(result).toEqual({
				success: true,
				data: undefined
			});
		});

		it('should handle MCP response with non-JSON text', async () => {
			const databasePath = '/path/to/db.db';
			const mcpResponse = {
				content: [{
					text: 'Database switched successfully'
				}]
			};
			mockProtocolHandler.mockSuccess(mcpResponse);

			const result = await databaseService.switchDatabase(databasePath);

			expect(result).toEqual({
				success: false,
				error: 'Database switched successfully'
			});
		});
	});

	describe('getCurrentDatabase', () => {
		it('should call database/current and return database path', async () => {
			const currentDbPath = '/current/project.db';
			const mockResponse = { database: currentDbPath };
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.getCurrentDatabase();

			expect(mockProtocolHandler.sendRequest).toHaveBeenCalledWith(
				'database/current',
				{}
			);
			expect(result).toEqual({
				success: true,
				data: currentDbPath
			});
		});

		it('should handle null database response', async () => {
			const mockResponse = { database: null };
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.getCurrentDatabase();

			expect(result).toEqual({
				success: true,
				data: null
			});
		});

		it('should handle missing database property', async () => {
			const mockResponse = { other_property: 'value' };
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.getCurrentDatabase();

			expect(result).toEqual({
				success: true,
				data: null
			});
		});

		it('should handle empty string database', async () => {
			const mockResponse = { database: '' };
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.getCurrentDatabase();

			expect(result).toEqual({
				success: true,
				data: null
			});
		});

		it('should handle non-object response', async () => {
			mockProtocolHandler.mockSuccess('string response');

			const result = await databaseService.getCurrentDatabase();

			expect(result).toEqual({
				success: true,
				data: null
			});
		});

		it('should handle protocol handler exceptions', async () => {
			mockProtocolHandler.mockError(new Error('Connection timeout'));

			const result = await databaseService.getCurrentDatabase();

			expect(result).toEqual({
				success: false,
				error: 'Connection timeout'
			});
			expect(console.error).toHaveBeenCalledWith(
				'Get current database error:',
				expect.any(Error)
			);
		});

		it('should extract data from MCP response format', async () => {
			const dbPath = '/extracted/from/mcp.db';
			const mcpResponse = {
				content: [{
					text: JSON.stringify({ database: dbPath })
				}]
			};
			mockProtocolHandler.mockSuccess(mcpResponse);

			const result = await databaseService.getCurrentDatabase();

			expect(result).toEqual({
				success: true,
				data: dbPath
			});
		});

		it('should handle MCP response without database field', async () => {
			const mcpResponse = {
				content: [{
					text: JSON.stringify({ status: 'no database set' })
				}]
			};
			mockProtocolHandler.mockSuccess(mcpResponse);

			const result = await databaseService.getCurrentDatabase();

			expect(result).toEqual({
				success: true,
				data: null
			});
		});
	});

	describe('pickDatabase', () => {
		it('should call database/pick and return selected path', async () => {
			const selectedPath = '/user/selected/database.db';
			const mockResponse = { 
				success: true, 
				path: selectedPath 
			};
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.pickDatabase();

			expect(mockProtocolHandler.sendRequest).toHaveBeenCalledWith(
				'database/pick',
				{}
			);
			expect(result).toEqual({
				success: true,
				data: selectedPath
			});
		});

		it('should handle cancelled file selection', async () => {
			const mockResponse = { 
				cancelled: true 
			};
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.pickDatabase();

			expect(result).toEqual({
				success: false,
				error: 'File selection cancelled'
			});
		});

		it('should handle file picker failure', async () => {
			const mockResponse = { 
				success: false, 
				error: 'File picker not available' 
			};
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.pickDatabase();

			expect(result).toEqual({
				success: false,
				error: 'File picker not available'
			});
		});

		it('should handle file picker failure without specific error', async () => {
			const mockResponse = { 
				success: false 
			};
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.pickDatabase();

			expect(result).toEqual({
				success: false,
				error: 'File picker failed'
			});
		});

		it('should handle invalid response format', async () => {
			mockProtocolHandler.mockSuccess('invalid response format');

			const result = await databaseService.pickDatabase();

			expect(result).toEqual({
				success: false,
				error: 'Invalid response from file picker'
			});
		});

		it('should handle protocol handler exceptions', async () => {
			mockProtocolHandler.mockError(new Error('File system access denied'));

			const result = await databaseService.pickDatabase();

			expect(result).toEqual({
				success: false,
				error: 'File system access denied'
			});
			expect(console.error).toHaveBeenCalledWith(
				'File picker error:',
				expect.any(Error)
			);
		});

		it('should handle non-Error exceptions', async () => {
			mockProtocolHandler.mockError('Permission denied' as any);

			const result = await databaseService.pickDatabase();

			expect(result).toEqual({
				success: false,
				error: 'Permission denied'
			});
		});

		it('should extract data from MCP response format', async () => {
			const pickedPath = '/mcp/extracted/path.db';
			const mcpResponse = {
				content: [{
					text: JSON.stringify({ 
						success: true, 
						path: pickedPath 
					})
				}]
			};
			mockProtocolHandler.mockSuccess(mcpResponse);

			const result = await databaseService.pickDatabase();

			expect(result).toEqual({
				success: true,
				data: pickedPath
			});
		});

		it('should handle MCP response with cancellation', async () => {
			const mcpResponse = {
				content: [{
					text: JSON.stringify({ 
						cancelled: true 
					})
				}]
			};
			mockProtocolHandler.mockSuccess(mcpResponse);

			const result = await databaseService.pickDatabase();

			expect(result).toEqual({
				success: false,
				error: 'File selection cancelled'
			});
		});

		it('should handle complex file picker response', async () => {
			const selectedPath = '/complex/path with spaces/database file.sqlite';
			const mockResponse = {
				success: true,
				path: selectedPath,
				file_type: 'sqlite',
				size: 1024000,
				last_modified: '2024-01-01T12:00:00Z'
			};
			mockProtocolHandler.mockSuccess(mockResponse);

			const result = await databaseService.pickDatabase();

			expect(result).toEqual({
				success: true,
				data: selectedPath
			});
		});
	});

	describe('MCP Data Extraction', () => {
		it('should extract JSON data from content array', () => {
			const extractData = (databaseService as any).extractDatabaseData.bind(databaseService);
			
			const mcpResponse = {
				content: [{
					text: JSON.stringify({ database: '/test/path.db' })
				}]
			};

			const result = extractData(mcpResponse);
			expect(result).toEqual({ database: '/test/path.db' });
		});

		it('should extract plain text from content array', () => {
			const extractData = (databaseService as any).extractDatabaseData.bind(databaseService);
			
			const mcpResponse = {
				content: [{
					text: 'Plain text response'
				}]
			};

			const result = extractData(mcpResponse);
			expect(result).toBe('Plain text response');
		});

		it('should extract direct content without text property', () => {
			const extractData = (databaseService as any).extractDatabaseData.bind(databaseService);
			
			const mcpResponse = {
				content: [{
					database: '/direct/content.db',
					status: 'success'
				}]
			};

			const result = extractData(mcpResponse);
			expect(result).toEqual({
				database: '/direct/content.db',
				status: 'success'
			});
		});

		it('should return original data when not in MCP format', () => {
			const extractData = (databaseService as any).extractDatabaseData.bind(databaseService);
			
			const directResponse = { database: '/direct/response.db' };
			
			const result = extractData(directResponse);
			expect(result).toEqual(directResponse);
		});

		it('should handle empty content array', () => {
			const extractData = (databaseService as any).extractDatabaseData.bind(databaseService);
			
			const mcpResponse = { content: [] };
			
			const result = extractData(mcpResponse);
			expect(result).toEqual(mcpResponse);
		});

		it('should handle null or undefined input', () => {
			const extractData = (databaseService as any).extractDatabaseData.bind(databaseService);
			
			expect(extractData(null)).toBe(null);
			expect(extractData(undefined)).toBe(undefined);
		});

		it('should handle malformed JSON in content', () => {
			const extractData = (databaseService as any).extractDatabaseData.bind(databaseService);
			
			const mcpResponse = {
				content: [{
					text: '{"invalid": json malformed'
				}]
			};

			const result = extractData(mcpResponse);
			expect(result).toBe('{"invalid": json malformed');
		});
	});

	describe('Integration Scenarios', () => {
		it('should handle complete database switching workflow', async () => {
			// Check current database
			mockProtocolHandler.mockSuccess({ database: '/old/database.db' });
			const currentResult = await databaseService.getCurrentDatabase();
			expect(currentResult.data).toBe('/old/database.db');

			// Pick new database
			mockProtocolHandler.reset();
			mockProtocolHandler.mockSuccess({ 
				success: true, 
				path: '/new/selected.db' 
			});
			const pickResult = await databaseService.pickDatabase();
			expect(pickResult.data).toBe('/new/selected.db');

			// Switch to new database
			mockProtocolHandler.reset();
			mockProtocolHandler.mockSuccess({ success: true });
			const switchResult = await databaseService.switchDatabase('/new/selected.db');
			expect(switchResult.success).toBe(true);

			// Verify switch
			mockProtocolHandler.reset();
			mockProtocolHandler.mockSuccess({ database: '/new/selected.db' });
			const verifyResult = await databaseService.getCurrentDatabase();
			expect(verifyResult.data).toBe('/new/selected.db');
		});

		it('should handle failed database operations gracefully', async () => {
			// Failed pick
			mockProtocolHandler.mockSuccess({ cancelled: true });
			const pickResult = await databaseService.pickDatabase();
			expect(pickResult.success).toBe(false);

			// Failed switch due to invalid path
			mockProtocolHandler.reset();
			mockProtocolHandler.mockError(new Error('File not found'));
			const switchResult = await databaseService.switchDatabase('/nonexistent.db');
			expect(switchResult.success).toBe(false);

			// Current database still accessible
			mockProtocolHandler.reset();
			mockProtocolHandler.mockSuccess({ database: '/current/working.db' });
			const currentResult = await databaseService.getCurrentDatabase();
			expect(currentResult.success).toBe(true);
		});

		it('should handle concurrent database operations', async () => {
			mockProtocolHandler.sendRequest
				.mockResolvedValueOnce({ database: '/current.db' })
				.mockResolvedValueOnce({ success: true, path: '/picked.db' })
				.mockResolvedValueOnce({ success: true });

			const [currentResult, pickResult, switchResult] = await Promise.all([
				databaseService.getCurrentDatabase(),
				databaseService.pickDatabase(),
				databaseService.switchDatabase('/new.db')
			]);

			expect(currentResult.success).toBe(true);
			expect(pickResult.success).toBe(true);
			expect(switchResult.success).toBe(true);
			expect(mockProtocolHandler.sendRequest).toHaveBeenCalledTimes(3);
		});

		it('should handle database path validation scenarios', async () => {
			const testPaths = [
				'/valid/path/database.db',
				'/path with spaces/my database.sqlite',
				'/unicode/测试数据库.db',
				'relative/path.db',
				'C:\\Windows\\path\\database.db', // Windows path
				'/path/with/dots/../database.db'
			];

			for (const path of testPaths) {
				mockProtocolHandler.reset();
				mockProtocolHandler.mockSuccess({ success: true });

				const result = await databaseService.switchDatabase(path);
				
				expect(mockProtocolHandler.sendRequest).toHaveBeenCalledWith(
					'database/switch',
					{ database: path }
				);
				expect(result.success).toBe(true);
			}
		});
	});

	describe('Error Recovery', () => {
		it('should handle temporary network issues', async () => {
			// First call fails
			mockProtocolHandler.mockError(new Error('Network timeout'));
			const firstResult = await databaseService.getCurrentDatabase();
			expect(firstResult.success).toBe(false);

			// Second call succeeds
			mockProtocolHandler.reset();
			mockProtocolHandler.mockSuccess({ database: '/recovered.db' });
			const secondResult = await databaseService.getCurrentDatabase();
			expect(secondResult.success).toBe(true);
			expect(secondResult.data).toBe('/recovered.db');
		});

		it('should handle malformed server responses gracefully', async () => {
			const malformedResponses = [
				null,
				undefined,
				123,
				'string response',
				{ unexpected: 'format' },
				{ content: 'not an array' },
				{ content: [{ malformed: 'content' }] }
			];

			for (const response of malformedResponses) {
				mockProtocolHandler.reset();
				mockProtocolHandler.mockSuccess(response);

				const result = await databaseService.getCurrentDatabase();
				
				// Should not throw, should handle gracefully
				expect(typeof result).toBe('object');
				expect(result).toHaveProperty('success');
			}
		});
	});
});