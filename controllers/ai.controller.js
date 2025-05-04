import AIService from '#services/ai.service.js';

class AIController {

	static async resolveCheck(req, res) {
		try {
			const { prompt } = req.body;
			if (!prompt) return res.respond({ status: 400, message: 'Prompt is required' });

			// Simulate AI processing
			const response = await AIService.resolveCheck(prompt);

			return res.respond({ status: 200, message: 'Success', data: response });
		} catch (error) {
			return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
		}
	}
}

export default AIController;