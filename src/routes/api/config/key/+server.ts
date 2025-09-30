import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { configService } from '$lib/services/config-service';

/**
 * GET /api/config/key - Get decrypted API key
 * This endpoint is for internal application use only
 */
export const GET: RequestHandler = async () => {
	try {
		const apiKey = await configService.getClaudeApiKey();

		if (!apiKey) {
			throw error(404, 'No API key configured');
		}

		return json({
			success: true,
			apiKey: apiKey
		});
	} catch (err: any) {
		console.error('Failed to get API key:', err);

		if (err.status === 404) {
			throw err;
		}

		throw error(500, 'Failed to retrieve API key');
	}
};