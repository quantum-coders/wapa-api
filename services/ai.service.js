import 'dotenv/config';
import OpenAI from 'openai';
import ToolService from '#services/tool.service.js';

import * as wapaTemplates from '#assets/templates/wapa.js';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

class AIService {

	/**
	 * Generates a cool response to a message.
	 * @param message {string} - The message to respond to.
	 * @return {Promise<string>} - The generated response.
	 */
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

	/**
	 * Generates a response to a message using a template.
	 * @param message {string} - The message to respond to.
	 * @param system {string} - The system prompt to use.
	 * @param history {Array} - The conversation history.
	 * @return {Promise<Object>} - The generated response.
	 */
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

	/**
	 * Generates a response to a message using the onboarding conversation template.
	 * @param prompt {string} - The message to respond to.
	 * @param context {Object} - The context to use for the conversation.
	 * @return {Promise<any>} - The generated response.
	 */
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

	/**
	 * Prepares the conversation history for the OpenAI API.
	 * @param messages {Array} - The messages to prepare.
	 * @param limit {number} - The maximum number of messages to include.
	 * @return {Promise<Array>} - The prepared conversation history.
	 */
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

	/**
	 * Generates a response to a message using the tooled conversation template.
	 * @param from {string} - The sender of the message.
	 * @param prompt {string} - The message to respond to.
	 * @param context {Object} - The context to use for the conversation.
	 * @param rawMessages {Array} - The raw messages to use for the conversation.
	 * @return {Promise<string>} - The generated response.
	 */
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

		let toolResponse = null;

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

				try {
					toolResponse = await ToolService[name](args);

					if(name === 'getWalletBalance') {
						console.log('toolResponse', toolResponse);

						// replace %amount% with the actual amount
						if(toolResponse) {
							args.continueConversation = args.continueConversation.replace('%amount%', toolResponse.balance);
						}
					}

					if(name === 'sendMoney') {
						console.log('toolResponse', toolResponse);

						// replace %amount% with the actual amount
						if(toolResponse) {

							// transaction details
							const transactionDetails = `Link: https://sepolia.arbiscan.io/tx/${ toolResponse.transaction.hash }`;

							args.continueConversation = args.continueConversation.replace('%amount%', toolResponse.amount);
							args.continueConversation = args.continueConversation.replace('%name%', toolResponse.contactName);
							args.continueConversation = args.continueConversation.replace('%transaction_details%', '\n\n' + transactionDetails);
						}
					}
				} catch(e) {
					console.error('Error calling function:', e);
					args.continueConversation = 'Lo siento, hubo un error al procesar tu solicitud. Por favor intenta de nuevo más tarde.';
				}
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

	/**
	 * Checks if a tweet is susceptible to fact check.
	 * @param prompt {string} - The tweet content to check.
	 * @return {Promise<any>} - The result of the fact check.
	 */
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
