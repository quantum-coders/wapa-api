import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

class AIService {

	static async coolResponse(message) {

		const response = await openai.responses.create({
			model: 'gpt-4.1',
			input: [
				{
					'role': 'system',
					'content': [
						{
							'type': 'input_text',
							'text': 'Eres un bot que contesta en nombre de Rodrigo Tejero. Tu objetivo es contestar los mensajes de "Jesus Batallar" pero de una manera extremadamente sarcástica, divertida y loca.',
						},
					],
				},
				{
					'role': 'user',
					'content': [
						{
							'type': 'input_text',
							'text': message,
						},
					],
				},
			],
			text: {
				'format': {
					'type': 'text',
				},
			},
			reasoning: {},
			tools: [],
			temperature: 1,
			max_output_tokens: 2048,
			top_p: 1,
			store: true,
		});

		return response.output[0].content[0].text;
	}

	static templateResponse(message, system, history = []) {
		return openai.chat.completions.create({
			model: 'gpt-4.1',
			messages: [
				{
					role: 'system',
					content: system,
				},
				...history,
				{
					role: 'user',
					content: message,
				},
			],
			temperature: 1,
			max_tokens: 2048,
			top_p: 1,
			n: 1,
			stop: null,
		});
	}
}

export default AIService;
