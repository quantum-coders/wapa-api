import 'dotenv/config';
import OpenAI from 'openai';
import ToolService from '#services/tool.service.js';

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

		//console.log('prepareConversationHistory', messages);

		//If there are no messages, return an empty array
		if(!messages || messages.length === 0) return [];

		// Sort messages by timestamp in ascending order
		const sortedMessages = [ ...messages ].sort((a, b) => a.timestamp - b.timestamp);

		// Filter out messages with empty bodies
		const messagesWithContent = sortedMessages.filter(msg => msg.body && msg.body.trim() !== '');

		// Get the last 'limit' messages
		const recentMessages = messagesWithContent.slice(-limit);

		// Transform messages into the required format for OpenAI API
		return recentMessages.map(msg => {
			// Determine the role based on fromMe property
			const role = !msg.fromMe ? 'user' : 'assistant';
			const type = !msg.fromMe ? 'input_text' : 'output_text';

			return {
				'role': role,
				'content': [
					{
						'type': type,
						'text': msg.body || '',  // Use empty string if body is null
					},
				],
			};
		});
	}

	static async tooledConversation(from, prompt, context, rawMessages) {
		// Prepare conversation history from raw messages
		const history = await AIService.prepareConversationHistory(rawMessages);

		//console.log('History:', JSON.stringify(history, null, 2));

		// Create the input array with system message, history, and current prompt
		const inputArray = [
			{
				'role': 'system',
				'content': [
					{
						'type': 'input_text',
						'text': wapaTemplates.tooledSystemPrompt + `\n\nContexto del usuario:\n${ JSON.stringify(context) }`,
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

		//console.log('Response:', JSON.stringify(response, null, 2));

		if(response.output[0].type === 'function_call') {
			// JSON encode arguments
			const name = response.output[0].name;
			const args = JSON.parse(response.output[0].arguments);

			console.log('Function name:', name);
			console.log('Function arguments:', args);
			console.log('Available methods:', Object.getOwnPropertyNames(ToolService));

			// Call the function with the name and arguments as static methods of the class AIService
			if(typeof ToolService[name] === 'function') {
				console.log('Calling function:', name, 'with args:', args);
				// add from as idWa to the args
				args.idWa = from;
				await ToolService[name](args);
			}

			// check if args contain "continueConversation"
			if(args.continueConversation) {
				console.log('continueConversation:', args.continueConversation);

				// If it does, return the continueConversation message
				return args.continueConversation;
			}

		} else if(response.output[0].type === 'message') {
			// If the response is a text, return it
			return response.output[0].content[0].text;
		}

		return false;
	}

	static async resolveCheck(prompt) {

		const res = await openai.responses.create({
			model: 'gpt-4.1',
			input: [
				{
					'role': 'system',
					'content': [
						{
							'type': 'input_text',
							'text': 'You are an expert fact checker and your job is to receive the content of twitter posts and validate if the content is susceptible to fact check.\n\nYou will respond:\n1. `result`: true if the tweet content is susceptible to fact checking, false if not.\n2. `reason`: The reason for your answer\n\nRespond in JSON Format.',
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
					'type': 'json_object',
				},
			},
			reasoning: {},
			tools: [],
			temperature: 1,
			max_output_tokens: 2048,
			top_p: 1,
			store: true,
		});

		return JSON.parse(res.output_text);
	}
}

export default AIService;
