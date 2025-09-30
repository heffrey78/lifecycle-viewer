import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { configService } from '$lib/services/config-service';

/**
 * POST /api/config/test - Test Claude API key
 * Body: { apiKey?: string } - Optional, uses stored key if not provided
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		let { apiKey } = body;

		// If no API key provided, try to get from config
		if (!apiKey) {
			apiKey = await configService.getClaudeApiKey();
			if (!apiKey) {
				throw error(400, 'No API key configured. Please provide an API key.');
			}
		}

		// Test the API key with a minimal request
		const response = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: 'claude-3-5-sonnet-20241022',
				max_tokens: 10,
				messages: [{ role: 'user', content: 'test' }]
			})
		});

		if (response.ok) {
			return json({
				success: true,
				message: 'API key is valid and working!'
			});
		} else {
			const data = await response.json();
			const errorMessage = data.error?.message || 'Invalid API key';

			return json(
				{
					success: false,
					message: `API key test failed: ${errorMessage}`
				},
				{ status: 400 }
			);
		}
	} catch (err: any) {
		console.error('Failed to test API key:', err);

		if (err.status) {
			throw err; // Re-throw SvelteKit errors
		}

		return json(
			{
				success: false,
				message: `API key test failed: ${err.message || 'Unknown error'}`
			},
			{ status: 500 }
		);
	}
};