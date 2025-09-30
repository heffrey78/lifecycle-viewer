import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { configService } from '$lib/services/config-service';

/**
 * GET /api/config - Get configuration metadata
 */
export const GET: RequestHandler = async () => {
	try {
		const metadata = configService.getConfigMetadata();
		const isConfigured = await configService.isClaudeApiKeyConfigured();

		return json({
			success: true,
			data: {
				...metadata,
				isApiKeyConfigured: isConfigured
			}
		});
	} catch (err) {
		console.error('Failed to get config metadata:', err);
		throw error(500, 'Failed to retrieve configuration');
	}
};

/**
 * POST /api/config - Update configuration
 * Body: { apiKey: string }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { apiKey } = body;

		if (!apiKey || typeof apiKey !== 'string') {
			throw error(400, 'API key is required');
		}

		// Validate API key format
		if (!apiKey.startsWith('sk-ant-')) {
			throw error(400, 'Invalid API key format. Must start with sk-ant-');
		}

		if (apiKey.length < 20) {
			throw error(400, 'API key is too short');
		}

		// Save the API key (will be encrypted)
		await configService.setClaudeApiKey(apiKey);

		return json({
			success: true,
			message: 'API key saved successfully'
		});
	} catch (err: any) {
		console.error('Failed to save API key:', err);

		if (err.status) {
			throw err; // Re-throw SvelteKit errors
		}

		throw error(500, err.message || 'Failed to save API key');
	}
};

/**
 * DELETE /api/config - Clear API key
 */
export const DELETE: RequestHandler = async () => {
	try {
		await configService.clearClaudeApiKey();

		return json({
			success: true,
			message: 'API key removed successfully'
		});
	} catch (err) {
		console.error('Failed to clear API key:', err);
		throw error(500, 'Failed to remove API key');
	}
};