import 'dotenv/config';
import OpenAI from 'openai';
import * as wapaTemplates from '#assets/templates/wapa.js';

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

	static async onboardingConversation(prompt, context = {}) {
		const response = await openai.responses.create({
			model: 'gpt-4.1',
			input: [
				{
					'role': 'system',
					'content': [
						{
							'type': 'input_text',
							'text': wapaTemplates.onboardingSystemPrompt,
						},
					],
				},
				{
					'role': 'assistant',
					'content': [
						{
							'type': 'output_text',
							'text': JSON.stringify(context),
						},
					],
				},
				{
					'role': 'user',
					'content': [
						{
							'type': 'input_text',
							'text': prompt,
						},
					],
				},
			],
			text: {
				'format': {
					...wapaTemplates.onboardingSchema,
				},
			},
			reasoning: {},
			tools: [],
			temperature: 1,
			max_output_tokens: 2048,
			top_p: 1,
			store: true,
		});

		return JSON.parse(response.output_text);
	}

	static async prepareConversationHistory(messages, limit = 10) {
		// Sort messages by timestamp in ascending order
		const sortedMessages = [ ...messages ].sort((a, b) => a.timestamp - b.timestamp);

		// Get the last 'limit' messages
		const recentMessages = sortedMessages.slice(-limit);

		// Transform messages into the required format for OpenAI API
		return recentMessages.map(msg => {
			// Determine the role based on fromMe property
			const role = msg.fromMe ? 'assistant' : 'user';

			return {
				'role': role,
				'content': [
					{
						'type': 'input_text',
						'text': msg.body || '',  // Use empty string if body is null
					},
				],
			};
		});
	}

	static async tooledConversation(prompt, rawMessages) {
		// Prepare conversation history from raw messages
		const history = AIService.prepareConversationHistory(rawMessages);

		console.log('History:', history);

		// Create the input array with system message, history, and current prompt
		const inputArray = [
			{
				'role': 'system',
				'content': [
					{
						'type': 'input_text',
						'text': wapaTemplates.tooledSystemPrompt,
					},
				],
			},
		];

		// Add history messages to input array
		inputArray.push(...history);

		// Add current user prompt
		inputArray.push({
			'role': 'user',
			'content': [
				{
					'type': 'input_text',
					'text': prompt,
				},
			],
		});

		const response = await openai.responses.create({
			model: 'gpt-4.1',
			input: inputArray,
			reasoning: {},
			tools: wapaTemplates.generalTools,
			temperature: 1,
			max_output_tokens: 2048,
			top_p: 1,
			store: true,
		});

		console.log('Response:', response);

		return false;
	}
}

export default AIService;
