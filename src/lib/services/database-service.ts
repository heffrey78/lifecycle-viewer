import type { MCPResponse } from '$lib/types/lifecycle.js';
import type { ProtocolHandler } from './protocol-handler.js';

export class DatabaseService {
	constructor(private protocolHandler: ProtocolHandler) {}

	private extractDatabaseData(result: any): any {
		if (result && result.content && Array.isArray(result.content) && result.content.length > 0) {
			const content = result.content[0];
			if (content.text) {
				try {
					return JSON.parse(content.text);
				} catch {
					return content.text;
				}
			}
			return content;
		}
		return result;
	}

	async switchDatabase(databasePath: string): Promise<MCPResponse<void>> {
		try {
			const result = await this.protocolHandler.sendRequest('database/switch', { 
				database: databasePath 
			});
			const data = this.extractDatabaseData(result);

			if (data && (data.success === true || typeof data === 'object')) {
				return { success: true, data: undefined };
			} else {
				return { success: false, error: data || 'Database switch failed' };
			}
		} catch (error) {
			console.error('Database switch error:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			return { success: false, error: errorMessage };
		}
	}

	async getCurrentDatabase(): Promise<MCPResponse<string | null>> {
		try {
			const result = await this.protocolHandler.sendRequest('database/current', {});
			const data = this.extractDatabaseData(result);

			if (data && typeof data === 'object' && 'database' in data) {
				return { success: true, data: data.database || null };
			} else {
				return { success: true, data: null };
			}
		} catch (error) {
			console.error('Get current database error:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			return { success: false, error: errorMessage };
		}
	}

	async pickDatabase(): Promise<MCPResponse<string | null>> {
		try {
			const result = await this.protocolHandler.sendRequest('database/pick', {});
			const data = this.extractDatabaseData(result);

			if (data && typeof data === 'object') {
				if (data.success && data.path) {
					return { success: true, data: data.path };
				} else if (data.cancelled) {
					return { success: false, error: 'File selection cancelled' };
				} else {
					return { success: false, error: data.error || 'File picker failed' };
				}
			} else {
				return { success: false, error: 'Invalid response from file picker' };
			}
		} catch (error) {
			console.error('File picker error:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			return { success: false, error: errorMessage };
		}
	}
}