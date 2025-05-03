// unified-ai.service.js
import 'dotenv/config';
import axios from 'axios';
import { promptTokensEstimate } from 'openai-chat-tokens';
import {
	groqModels,
	openAIModels,
	openRouterModels,
	perplexityModels,
	googleModels,
} from '../assets/data/ai-models.js';
import { createLogger } from '#utils/logger.js';
import { StringDecoder } from 'string_decoder';
import { PrimateService } from '@thewebchimp/primate';
import MessageService from '#entities/messages/message.service.js';
import UploadService from '#services/upload.service.js';

class AIService {
	// Create a logger instance for the service
	static logger = createLogger({ name: 'AIService' });

	/**
	 * Sends a message to the appropriate AI provider API.
	 * Enhanced with context management and function execution.
	 */
	static async sendMessage(data) {
		const functionName = 'sendMessage';
		// Avoid logging full history/prompt in entry if potentially large/sensitive
		this.logger.entry(functionName, {
			model: data.model,
			systemLength: data.system?.length,
			promptLength: data.prompt?.length,
			historyLength: data.history?.length,
			stream: data.stream,
			toolsCount: data.tools?.length,
			responseFormat: data.responseFormat,
			contextProvided: !!data.context,
			idChat: data.idChat,
			idThread: data.idThread,
		});

		let {
			model,
			system = '',
			prompt,
			stream = false,
			history = [],
			temperature = 0.5,
			max_tokens, // Will be calculated if not provided
			top_p = 1,
			frequency_penalty = 0.0001,
			presence_penalty = 0,
			stop = '',
			tools = [],
			toolChoice = 'auto',
			responseFormat = null, // Expects object like { type: "json_object" }
			context = null,
			idChat,
			idThread,
			userId,
			url,
			searchConfig,
			executeTools = false,
		} = data;

		if(!model) {
			this.logger.error('Missing required field: model', {});
			throw new Error('Missing field: model');
		}
		if(!prompt) {
			this.logger.error('Missing required field: prompt', {});
			throw new Error('Missing field: prompt');
		}

		try {
			// 1. Get model info (provider, auth, context window)
			this.logger.info('Step 1: Resolving model info...');
			const modelInfo = this.solveModelInfo(model); // Logs internally
			const { provider, contextWindow, authToken } = modelInfo;
			this.logger.info(`Model resolved: ${ model }, Provider: ${ provider }, Context: ${ contextWindow }`);

			// 1.1 Load chat history if idChat and idThread are provided
			if(idChat && idThread && !history.length) {
				this.logger.info('Loading chat history from database...');
				const historyData = await MessageService.getHistory(idChat, idThread);
				history = historyData.messages || [];
				if(!context && historyData.context) {
					context = historyData.context;
					this.logger.info('Loaded context from chat history');
				}
				this.logger.info(`Loaded ${ history.length } messages from history`);
			}

			// 1.2 Enhance system prompt with context if available
			if(context) {
				this.logger.info('Enhancing system prompt with context...');
				system = `${ system }\n\n#Context:\n${ JSON.stringify(context) }\n\n`;
				this.logger.debug('System prompt enhanced with context');
			}

			// 2. Adjust content length if needed
			this.logger.info('Step 2: Adjusting content length for context window...');
			const adjusted = this.adjustContent(system, history, prompt, contextWindow); // Logs internally
			system = adjusted.system;
			history = adjusted.history;
			prompt = adjusted.prompt;
			this.logger.info('Content adjustment complete.');

			// 3. Build messages array
			this.logger.info('Step 3: Building messages array...');
			const messages = [
				{ role: 'system', content: system },
				...history,
				{ role: 'user', content: prompt },
			];
			this.logger.debug(`Built ${ messages.length } messages.`, {});

			// 4. Calculate max_tokens dynamically if not provided
			this.logger.info('Step 4: Calculating max_tokens...');
			const estimatedPromptTokens = this.estimateTokens(messages); // Logs internally
			let calculatedMaxTokens = contextWindow - estimatedPromptTokens - 10; // Subtract buffer (e.g., 10 tokens)
			if(calculatedMaxTokens < 1) calculatedMaxTokens = 100; // Ensure a minimum reasonable value

			let finalMaxTokens;
			if(typeof max_tokens === 'number' && max_tokens > 0) {
				finalMaxTokens = max_tokens;
				this.logger.info(`Using provided max_tokens: ${ finalMaxTokens }`);
			} else {
				finalMaxTokens = calculatedMaxTokens;
				this.logger.info(`Using calculated max_tokens: ${ finalMaxTokens } (Context: ${ contextWindow }, Prompt: ${ estimatedPromptTokens })`);
			}
			// Override if JSON mode is specified (as per original logic)
			if(responseFormat && responseFormat.type === 'json_object') {
				finalMaxTokens = 4096; // OpenAI's limit for JSON mode often implies this
				this.logger.info(`Response format is JSON, overriding max_tokens to ${ finalMaxTokens }`);
			}

			// 5. Construct the core request body
			this.logger.info('Step 5: Constructing request body...');
			const requestData = {
				model,
				messages,
				temperature,
				top_p,
				frequency_penalty,
				presence_penalty,
				stream,
				max_tokens: finalMaxTokens,
			};
			this.logger.debug('Core request data constructed.', {});

			// 6. Add tools if applicable
			if(tools && tools.length > 0) {
				this.logger.info('Step 6: Adding tools to request...');

				if(provider === 'openai' || provider === 'openrouter') {
					requestData.tools = tools;
					requestData.tool_choice = toolChoice;
					this.logger.debug('Tools added:', { count: tools.length, choice: requestData.tool_choice });
				} else if(provider === 'google') {
					// Google has a different format for tools
					requestData.tools = tools;
					this.logger.debug('Tools added for Google:', { count: tools.length });
				} else {
					this.logger.warn(`Tools provided but provider '${ provider }' does not support them in this implementation. Tools ignored.`, {});
				}
			} else {
				this.logger.info('Step 6: No tools provided or applicable.');
			}

			// 7. Add response_format if provided and supported
			if(responseFormat) {
				this.logger.info('Step 7: Adding response_format to request...');
				if(provider === 'openai' || provider === 'openrouter') {
					requestData.response_format = responseFormat;
					this.logger.debug('response_format added:', responseFormat);
				} else if(provider === 'google' && responseFormat.type === 'json_object') {
					// Google has a different way of specifying JSON output
					requestData.responseSchema = {
						type: 'object',
						properties: {},
					};
					this.logger.debug('responseSchema added for Google JSON format');
				} else {
					this.logger.warn(`Response format provided but provider '${ provider }' might not support it in the same way.`, {});
				}
			} else {
				this.logger.info('Step 7: No response_format provided.');
			}

			// 7.1 Add search configuration if provided (Google specific)
			if(searchConfig && provider === 'google') {
				this.logger.info('Adding search configuration for Google...');
				requestData.searchConfig = searchConfig;
				this.logger.debug('searchConfig added');
			}

			// Add stop sequence if provided
			if(stop) {
				requestData.stop = stop;
				this.logger.debug('Stop sequence added:', { stop });
			}

			// 8. Determine provider URL
			this.logger.info('Step 8: Resolving provider URL...');
			const url = this.solveProviderUrl(provider); // Logs internally
			this.logger.info(`Using provider URL: ${ url }`);

			// 9. Configure Axios (headers, streaming)
			this.logger.info('Step 9: Configuring Axios request...');
			const headers = {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${ authToken }`,
			};
			// Add specific headers for OpenRouter if needed
			if(provider === 'openrouter') {
				headers['HTTP-Referer'] = process.env.OPEN_ROUTER_REFERER || 'http://localhost'; // Replace with your site URL
				headers['X-Title'] = process.env.OPEN_ROUTER_TITLE || 'AI Service'; // Replace with your app name
				this.logger.debug('Added OpenRouter specific headers.', {});
			}

			const axiosConfig = { headers };
			if(stream) {
				axiosConfig.responseType = 'stream';
				this.logger.info('Axios configured for streaming response.');
			} else {
				this.logger.info('Axios configured for standard JSON response.');
			}
			this.logger.debug('Final Axios config ready.', {});
			this.logger.debug('Final Request Body (messages truncated):', {
				...requestData,
				tools: `[${ tools.length } tools]`,
				system: system,
			});

			// 10. Make the API call
			this.logger.info(`Step 10: Sending request to ${ provider } at ${ url }...`);
			const startTime = Date.now();
			const response = await axios.post(url, requestData, axiosConfig);
			const duration = Date.now() - startTime;

			// 11. Execute tools if requested and applicable (for function calling)
			let toolResults = null;
			if(executeTools && tools.length > 0 && !stream) {
				this.logger.info('Step 11: Checking for tool calls to execute...');

				if(provider === 'openai') {
					const toolCalls = response.data?.choices?.[0]?.message?.tool_calls;
					if(toolCalls && toolCalls.length > 0) {
						this.logger.info(`Found ${ toolCalls.length } tool calls to execute`);
						toolResults = await this.executeToolCalls(toolCalls, tools);
					}
				} else if(provider === 'google') {
					// Handle Google's function calling format if needed
					const functionCall = response.data?.candidates?.[0]?.content?.parts?.[0]?.functionCall;
					if(functionCall) {
						this.logger.info(`Found function call to execute: ${ functionCall.name }`);
						// Implementation for Google function calls would go here
					}
				}
			} else {
				this.logger.info('Step 11: Tool execution skipped.');
			}

			// 12. Save response to chat history if requested
			if(idChat && idThread && userId && !stream) {
				this.logger.info('Step 12: Saving response to chat history...');

				// Extract the response text based on provider
				let responseText = '';
				let updatedContext = context || {};

				if(provider === 'openai') {
					responseText = response.data?.choices?.[0]?.message?.content || '';
				} else if(provider === 'google') {
					responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
				}

				// Update context with new information if we have a response
				if(responseText && context) {
					try {
						// Use a separate API call to extract context updates
						const contextResponse = await this.extractContext(prompt, responseText, context);
						updatedContext = { ...context, ...contextResponse };
						this.logger.info('Context updated with new information');
					} catch(contextError) {
						this.logger.warn('Failed to update context:', contextError);
					}
				}

				// Save the message to the database
				await PrimateService.create('message', {
					idUser: userId,
					idChat,
					idThread,
					role: 'assistant',
					text: responseText,
					metas: {
						url,
						context: updatedContext,
						toolResults: toolResults ? JSON.stringify(toolResults) : undefined,
					},
				});

				this.logger.info('Response saved to chat history');
			} else {
				this.logger.info('Step 12: Not saving to chat history (missing parameters or streaming)');
			}

			// Handle response based on stream or not
			if(stream) {
				this.logger.success(`Stream request successful. Status: ${ response.status }. Duration: ${ duration }ms. Returning stream object.`, {});
				this.logger.exit(functionName, { stream: true, status: response.status });
				return response; // Return the raw Axios response with the stream
			} else {
				this.logger.success(`Request successful. Status: ${ response.status }. Duration: ${ duration }ms.`, {});
				this.logger.debug('Response data:', response.data); // Log the actual data for non-stream

				// If we executed tools, append the results
				if(toolResults) {
					response.data.toolResults = toolResults;
				}

				this.logger.exit(functionName, {
					stream: false,
					status: response.status,
					responseId: response.data?.id,
					hasToolResults: !!toolResults,
				});
				return response.data;
			}
		} catch(error) {
			// Enhanced error logging from Axios errors
			if(error.response) {
				this.logger.error(`API Error: Provider responded with status ${ error.response.status }. URL: ${ error.config?.url }`, error, { responseData: error.response.data });
				// Rethrow with more specific message if possible
				const apiErrorMessage = error.response?.data?.error?.message || JSON.stringify(error.response?.data);
				throw new Error(`Error processing request: API Error (${ error.response.status }): ${ apiErrorMessage }`);
			} else if(error.request) {
				this.logger.error(`API Error: No response received for request to ${ error.config?.url }`, error, { message: error.message });
				throw new Error(`Error processing request: No response from API provider.`);
			} else {
				this.logger.error('API Error: Request setup or processing failed.', error, { message: error.message });
				throw new Error('Error processing request: ' + error.message);
			}
			this.logger.exit(functionName, { error: true });
			// Error is re-thrown above with more context
		}
	}

	static async processStreamingResponse(stream, provider, sendSSE, onComplete, toolResults = {}) {
		const decoder = new StringDecoder('utf8');
		const buffers = {
			openai: '',
			google: '',
			perplexity: '',
			groq: '',
			openrouter: '',
		};

		// Variable local para acumular el mensaje completo
		let fullMessage = '';

		return new Promise((resolve, reject) => {
			stream.on('data', (chunk) => {
				const chunkStr = decoder.write(chunk);
				const lines = chunkStr.split('\n');

				lines.forEach(line => {
					if(line.trim() !== '') {
						// Procesar la línea y obtener el contenido
						const contentChunk = this.processLine(line, provider, buffers, sendSSE);
						if(contentChunk) {
							fullMessage += contentChunk;
						}
					}
				});
			});

			stream.on('end', () => {
				// Handle any remaining characters
				const remaining = decoder.end();
				if(remaining) {
					const lines = remaining.split('\n');
					lines.forEach(line => {
						if(line.trim() !== '') {
							const contentChunk = this.processLine(line, provider, buffers, sendSSE);
							if(contentChunk) {
								fullMessage += contentChunk;
							}
						}
					});
				}

				// Enviar el evento de finalización con los resultados de las herramientas
				sendSSE({
					type: 'complete',
					message: 'Provider finished',
					fullMessage, // El mensaje completo acumulado
					toolResults,   // Los resultados de las herramientas
				});

				onComplete(fullMessage);
				resolve(fullMessage);
			});

			stream.on('error', (error) => {
				sendSSE({ type: provider, error: error.message });
				onComplete('');
				reject(error);
			});
		});
	}

	/**
	 * Process individual line from stream
	 * @returns {string|null} The content chunk if available
	 */
	static processLine(line, provider, buffers, sendSSE) {
		// Remove "data: " prefix if it exists
		const dataPrefix = 'data: ';
		const actualLine = line.startsWith(dataPrefix) ? line.substring(dataPrefix.length) : line;

		let contentChunk = null;

		if(actualLine.trim() === '[DONE]') {
			sendSSE({ type: 'complete', message: 'Stream complete' });
			return null;
		}

		// Provider-specific handling
		if(provider === 'openai' || provider === 'openrouter') {
			try {
				const parsedData = JSON.parse(actualLine);
				const content = parsedData.choices?.[0]?.delta?.content || '';
				if(content) {
					sendSSE({ type: provider, data: { content } });
					contentChunk = content; // Retornar el contenido para acumularlo
				}
			} catch(e) {
				buffers[provider] += actualLine;
				// Try to see if we have a complete JSON object now
				try {
					const parsedData = JSON.parse(buffers[provider]);
					buffers[provider] = '';
					const content = parsedData.choices?.[0]?.delta?.content || '';
					if(content) {
						sendSSE({ type: provider, data: { content } });
						contentChunk = content; // Retornar el contenido para acumularlo
					}
				} catch(parseError) {
					// Still not a complete JSON, continue buffering
				}
			}
		} else if(provider === 'google') {
			// Código existente para Google...
			// Agregar devolución de contenido similar a lo anterior
		} else if(provider === 'perplexity' || provider === 'groq') {
			// Código existente para estos proveedores...
			// Agregar devolución de contenido similar a lo anterior
		}

		return contentChunk;
	}

	/**
	 * Extract JSON object from buffer
	 */
	static extractJSONObject(buffer) {
		let braceCount = 0;
		let inString = false;
		let escape = false;
		let start = -1;

		for(let i = 0; i < buffer.length; i++) {
			const char = buffer[i];

			if(inString) {
				if(escape) {
					escape = false;
				} else if(char === '\\') {
					escape = true;
				} else if(char === '"') {
					inString = false;
				}
				continue;
			}

			if(char === '"') {
				inString = true;
				continue;
			}

			if(char === '{') {
				if(braceCount === 0) start = i;
				braceCount++;
			} else if(char === '}') {
				braceCount--;
				if(braceCount === 0 && start !== -1) {
					return {
						jsonStr: buffer.substring(start, i + 1),
						remaining: buffer.substring(i + 1),
					};
				}
			}
		}

		return null;
	}

	/**
	 * Extract content from parsed data (Google format)
	 */
	static extractContent(data) {
		if(data.candidates?.[0]?.content?.parts?.[0]?.text) {
			return data.candidates[0].content.parts[0].text;
		}
		return '';
	}

	/**
	 * Execute tool calls returned from the model
	 */
	static async executeToolCalls(toolCalls, availableTools) {
		const functionName = 'executeToolCalls';
		this.logger.entry(functionName, { toolCallsCount: toolCalls.length });

		const results = [];

		for(const call of toolCalls) {
			try {
				const { function: func } = call;
				const { name, arguments: argsString } = func;

				// Find the matching tool definition
				const toolDef = availableTools.find(t => t.function.name === name);
				if(!toolDef) {
					this.logger.warn(`Tool ${ name } not found in available tools`, {});
					results.push({
						name,
						status: 'error',
						error: 'Tool not found',
						arguments: argsString,
					});
					continue;
				}

				// Parse the arguments
				let args;
				try {
					args = JSON.parse(argsString);
				} catch(parseError) {
					this.logger.error(`Failed to parse arguments for tool ${ name }`, parseError);
					results.push({
						name,
						status: 'error',
						error: 'Invalid arguments format',
						arguments: argsString,
					});
					continue;
				}

				// Check if the tool has an executor function
				if(!toolDef.executor || typeof toolDef.executor !== 'function') {
					this.logger.warn(`Tool ${ name } does not have an executor function`, {});
					results.push({
						name,
						status: 'error',
						error: 'Tool has no executor',
						arguments: args,
					});
					continue;
				}

				// Execute the tool
				this.logger.info(`Executing tool ${ name } with arguments:`, args);
				const result = await toolDef.executor(args);
				this.logger.info(`Tool ${ name } executed successfully`);

				results.push({
					name,
					status: 'success',
					result,
					arguments: args,
				});

			} catch(error) {
				this.logger.error(`Error executing tool call:`, error);
				results.push({
					name: call.function?.name || 'unknown',
					status: 'error',
					error: error.message,
					arguments: call.function?.arguments,
				});
			}
		}

		this.logger.exit(functionName, { resultsCount: results.length });
		return results;
	}

	/**
	 * Use AI to extract context updates from a conversation
	 */
	static async extractContext(prompt, response, currentContext) {
		const functionName = 'extractContext';
		this.logger.entry(functionName, { promptLength: prompt.length, responseLength: response.length });

		try {
			// Use a minimalist model for this task
			const result = await this.sendMessage({
				model: 'gpt-4.1-nano',
				system: `Return a JSON object with information to remember from the conversation based on the user input.
                Only store information if the message contains something meaningful, not trivial responses.
                Try to maintain everything as a key-value, with just one level of values in the JSON.
                Avoid creating new keys if the information is already present in the context.
                If there is an addition to an existing key, append the new information to the existing value, maybe with commas.
                Use the last JSON context and append the new information.`,
				prompt,
				history: [
					{ role: 'assistant', content: JSON.stringify(currentContext) },
					{ role: 'assistant', content: response },
				],
				responseFormat: { type: 'json_object' },
				temperature: 0.2,
			});

			const contextUpdates = result.choices?.[0]?.message?.content || '{}';
			const parsedContext = JSON.parse(contextUpdates);

			this.logger.exit(functionName, { updatesCount: Object.keys(parsedContext).length });
			return parsedContext;

		} catch(error) {
			this.logger.error('Failed to extract context updates:', error);
			this.logger.exit(functionName, { error: true });
			return {}; // Return empty object on error
		}
	}

	// ------------------------------------------------------------------
	//    Helper: Get Model Information - With added Google support
	// ------------------------------------------------------------------
	static solveModelInfo(model) {
		const functionName = 'solveModelInfo';
		this.logger.entry(functionName, { model });

		// Combine all known model definitions
		const allModels = [ ...openAIModels, ...perplexityModels, ...groqModels, ...openRouterModels, ...googleModels ];
		const modelInfo = allModels.find(m => m.name === model);

		if(!modelInfo) {
			this.logger.error(`Model info not found for specified model: ${ model }`, {});
			throw new Error(`Model info not found for: ${ model }`);
		}
		this.logger.debug('Found model info:', modelInfo);

		let provider = '';
		let authToken = '';

		// Determine provider and auth token based on which array the model was found in
		if(openAIModels.some(m => m.name === model)) {
			provider = 'openai';
			authToken = process.env.OPENAI_API_KEY;
			this.logger.debug('Provider determined: openai', {});
		} else if(perplexityModels.some(m => m.name === model)) {
			provider = 'perplexity';
			authToken = process.env.PERPLEXITY_API_KEY;
			this.logger.debug('Provider determined: perplexity', {});
		} else if(groqModels.some(m => m.name === model)) {
			provider = 'groq';
			authToken = process.env.GROQ_API_KEY;
			this.logger.debug('Provider determined: groq', {});
		} else if(openRouterModels.some(m => m.name === model)) {
			provider = 'openrouter';
			authToken = process.env.OPEN_ROUTER_KEY;
			this.logger.debug('Provider determined: openrouter', {});
		} else if(googleModels && googleModels.some(m => m.name === model)) {
			provider = 'google';
			authToken = process.env.GOOGLE_API_KEY;
			this.logger.debug('Provider determined: google', {});
		} else {
			// This case should technically not be reached if modelInfo was found, but good for safety
			this.logger.error(`Provider could not be determined for model: ${ model }, although info was found.`, {});
			throw new Error(`Provider not found for model: ${ model }`);
		}

		if(!authToken) {
			this.logger.error(`Authentication token not found in environment variables for provider: ${ provider }. Checked corresponding ENV key.`, {});
			throw new Error(`Auth token not found for provider: ${ provider }`);
		}
		this.logger.debug(`Auth token found for provider ${ provider }.`, {});

		const contextWindow = modelInfo.contextWindow || 4096; // Default context window if not specified
		this.logger.info(`Using context window: ${ contextWindow }`);

		const result = { ...modelInfo, provider, authToken, contextWindow };
		this.logger.exit(functionName, { provider, contextWindow });
		return result;
	}

	// ------------------------------------------------------------------
	//    Helper: Get Provider API URL - Updated with Google support
	// ------------------------------------------------------------------
	static solveProviderUrl(provider) {
		const functionName = 'solveProviderUrl';
		this.logger.entry(functionName, { provider });
		let url = '';

		if(provider === 'openai') {
			url = 'https://api.openai.com/v1/chat/completions';
		} else if(provider === 'perplexity') {
			url = 'https://api.perplexity.ai/chat/completions';
		} else if(provider === 'groq') {
			url = 'https://api.groq.com/openai/v1/chat/completions';
		} else if(provider === 'openrouter') {
			url = 'https://openrouter.ai/api/v1/chat/completions';
		} else if(provider === 'google') {
			url = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent';
			// Note: The model name needs to be replaced in the actual request
		} else {
			this.logger.error(`Provider URL not defined for unsupported provider: ${ provider }`, {});
			throw new Error(`Provider not supported: ${ provider }`);
		}

		this.logger.info(`Resolved URL for provider ${ provider }: ${ url }`);
		this.logger.exit(functionName, { url });
		return url;
	}

	// ------------------------------------------------------------------
	//    Helper: Adjust Content Length for Context Window
	// ------------------------------------------------------------------
	static adjustContent(system, history, prompt, contextWindow) {
		const functionName = 'adjustContent';
		// Log initial lengths for context
		this.logger.entry(functionName, {
			systemLen: system.length,
			historyLen: history.length,
			promptLen: prompt.length,
			contextWindow,
		});

		const targetTokens = contextWindow - 50; // Leave a buffer (e.g., 50 tokens) for response and safety
		this.logger.debug(`Target tokens (including buffer): ${ targetTokens }`, {});

		let messagesForEstimation = [
			{ role: 'system', content: system },
			...history,
			{ role: 'user', content: prompt },
		];
		let currentTokens = this.estimateTokens(messagesForEstimation); // Logs internally
		this.logger.info(`Initial token estimate: ${ currentTokens }`);

		if(currentTokens <= targetTokens) {
			this.logger.info('Initial tokens are within the target limit. No adjustment needed.');
			this.logger.exit(functionName, { adjusted: false });
			return { system, history, prompt };
		}

		this.logger.warn(`Initial tokens (${ currentTokens }) exceed target (${ targetTokens }). Starting adjustment...`, {});

		let iteration = 0;
		const maxIterations = history.length + 2; // Max iterations: remove all history + try trimming system/prompt

		// Trim history first (oldest messages)
		while(currentTokens > targetTokens && history.length > 0) {
			iteration++;
			this.logger.debug(`Iteration ${ iteration }: Removing oldest history message. Current tokens: ${ currentTokens }`, {});
			history.shift(); // Remove the oldest message
			messagesForEstimation = [ { role: 'system', content: system }, ...history, {
				role: 'user',
				content: prompt,
			} ];
			currentTokens = this.estimateTokens(messagesForEstimation);
		}

		// If still too long, try trimming system prompt (if significantly long)
		if(currentTokens > targetTokens && system.length > 200) { // Only trim long system prompts
			iteration++;
			const tokensOver = currentTokens - targetTokens;
			const charsToRemove = Math.ceil(tokensOver * 4); // Approximate characters to remove
			const trimLength = Math.min(charsToRemove, system.length - 100); // Keep at least 100 chars
			if(trimLength > 0) {
				this.logger.debug(`Iteration ${ iteration }: Trimming system prompt by ${ trimLength } chars. Current tokens: ${ currentTokens }`, {});
				system = system.substring(0, system.length - trimLength);
				messagesForEstimation = [ { role: 'system', content: system }, ...history, {
					role: 'user',
					content: prompt,
				} ];
				currentTokens = this.estimateTokens(messagesForEstimation);
			}
		}

		// Finally, if still too long, trim the user prompt (as a last resort)
		if(currentTokens > targetTokens && prompt.length > 200) { // Only trim long user prompts
			iteration++;
			const tokensOver = currentTokens - targetTokens;
			const charsToRemove = Math.ceil(tokensOver * 4);
			const trimLength = Math.min(charsToRemove, prompt.length - 100); // Keep at least 100 chars
			if(trimLength > 0) {
				this.logger.debug(`Iteration ${ iteration }: Trimming user prompt by ${ trimLength } chars. Current tokens: ${ currentTokens }`, {});
				prompt = prompt.substring(0, prompt.length - trimLength);
				// No need to recalculate tokens again, this is the last step
			}
		}

		if(currentTokens > targetTokens) {
			this.logger.warn(`Content adjustment finished, but tokens (${ currentTokens }) might still exceed target (${ targetTokens }) after trimming history and potentially prompts.`, {});
		} else {
			this.logger.info(`Content adjustment finished. Final token estimate: ${ currentTokens }`);
		}

		this.logger.exit(functionName, {
			adjusted: true,
			finalSystemLen: system.length,
			finalHistoryLen: history.length,
			finalPromptLen: prompt.length,
			finalTokenEst: currentTokens,
		});
		return { system, history, prompt };
	}

	// ------------------------------------------------------------------
	//    Helper: Estimate Tokens
	// ------------------------------------------------------------------
	static estimateTokens(messages) {
		// Simplified method without excessive logging
		try {
			const tokens = promptTokensEstimate({ messages });
			return tokens;
		} catch(error) {
			this.logger.warn(`Token estimation failed: ${ error.message }. Falling back to simple estimation.`, { error });
			// Fallback to simple character count / 4 as a rough estimate
			let charCount = 0;
			messages.forEach(msg => {
				charCount += msg.content?.length || 0;
			});
			const fallbackTokens = Math.ceil(charCount / 4);
			return fallbackTokens;
		}
	}

	// ------------------------------------------------------------------
	//    Express Controller Method: Process Message with SSE Streaming
	// ------------------------------------------------------------------
	static async handleAiMessage(req, res, userId) {
		const functionName = 'handleAiMessage';
		this.logger.entry(functionName, { userId });

		try {
			let {
				prompt,
				idChat,
				idThread,
				url,
				model = process.env.DEFAULT_AI_MODEL || 'gpt-4.1-nano',
				system,
				idCampaign,
				agent,
				tools = [],
				executeTools = true,
			} = req.body;

			if(!idCampaign) {
				this.logger.warn('Warning: idCampaign is missing. Operations requiring it may fail.', {
					userId,
					idChat,
					idThread,
				});
			}
			//TODO: testing toolCall
			tools = [
				{
					type: 'function',
					function: {
						name: 'webSearch',
						description: 'Search the web for current information on a given query.',
						parameters: {
							type: 'object',
							properties: {
								query: {
									type: 'string',
									description: 'The search query to look up.',
								},
							},
							required: [ 'query' ],
						},
					},
					executor: this.webSearch.bind(this),
				},

				// Tool para Channel Plan
				{
					type: 'function',
					function: {
						name: 'processChannelPlan',
						description: 'Processes and stores the recommended channel plan, including rationale, priority, and content format suggestions.',
						parameters: {
							type: 'object',
							properties: {
								channelPlan: {
									type: 'object',
									description: 'Contains the media channel strategy.',
									properties: {
										recommendedChannels: {
											type: 'array',
											items: {
												type: 'object',
												properties: {
													channel: { type: 'string' },
													rationale: { type: 'string' },
													priority: {
														type: 'string',
														enum: [ 'High', 'Medium', 'Low' ],
													},
												},
												required: [ 'channel', 'rationale', 'priority' ],
											},
										},
										contentFormatSuggestions: {
											type: 'object',
											description: 'Suggested content formats per channel.',
											additionalProperties: {
												type: 'array',
												items: { type: 'string' },
											},
										},
									},
									required: [ 'recommendedChannels', 'contentFormatSuggestions' ],
								},
								campaignId: {
									type: 'string',
									description: 'ID of the campaign to update',
								},
							},
							required: [ 'channelPlan', 'campaignId' ],
						},
					},
					executor: this.processChannelPlanExecutor.bind(this),
				},

				// Tool para Execution Assets
				{
					type: 'function',
					function: {
						name: 'processExecutionAssets',
						description: 'Processes and stores drafts or outlines for execution assets like social media calendars, landing pages, and email marketing.',
						parameters: {
							type: 'object',
							properties: {
								executionAssets: {
									type: 'object',
									description: 'Contains drafts for campaign execution materials.',
									properties: {
										socialMediaCalendarOutline: {
											type: 'string',
											description: 'AI-Generated suggested posting cadence.',
										},
										landingPageCopyDraft: {
											type: 'string',
											description: 'AI-Generated draft copy for landing page.',
										},
										emailMarketingDrafts: {
											type: 'array',
											items: {
												type: 'object',
												properties: {
													subject: { type: 'string' },
													body: { type: 'string' },
												},
												required: [ 'subject', 'body' ],
											},
										},
									},
									required: [ 'socialMediaCalendarOutline', 'landingPageCopyDraft', 'emailMarketingDrafts' ],
								},
								campaignId: {
									type: 'string',
									description: 'ID of the campaign to update',
								},
							},
							required: [ 'executionAssets', 'campaignId' ],
						},
					},
					executor: this.processExecutionAssetsExecutor.bind(this),
				},

				// Tool para Budget Outline
				{
					type: 'function',
					function: {
						name: 'processBudgetOutline',
						description: 'Processes and stores the budget outline, including estimated tier, suggested allocation ranges, and notes.',
						parameters: {
							type: 'object',
							properties: {
								budgetOutline: {
									type: 'object',
									description: 'Contains the high-level budget plan.',
									properties: {
										estimatedTotalTier: {
											type: 'string',
											description: 'Budget tier (e.g., Low, Medium, High).',
										},
										suggestedAllocationRanges: {
											type: 'object',
											description: 'Percentage allocation suggestions.',
											properties: {
												creativeProduction: { type: 'string' },
												mediaBuyDigital: { type: 'string' },
												influencerMarketing: { type: 'string' },
												posActivation: { type: 'string' },
												researchContingency: { type: 'string' },
											},
											required: [ 'creativeProduction', 'mediaBuyDigital', 'influencerMarketing', 'posActivation', 'researchContingency' ],
										},
										notes: { type: 'string' },
									},
									required: [ 'estimatedTotalTier', 'suggestedAllocationRanges', 'notes' ],
								},
								campaignId: {
									type: 'string',
									description: 'ID of the campaign to update',
								},
							},
							required: [ 'budgetOutline', 'campaignId' ],
						},
					},
					executor: this.processBudgetOutlineExecutor.bind(this),
				},

				// Tool para Roadmap Timeline
				{
					type: 'function',
					function: {
						name: 'processRoadmapTimeline',
						description: 'Processes and stores the campaign roadmap timeline, outlining phases and key activities.',
						parameters: {
							type: 'object',
							properties: {
								roadmapTimeline: {
									type: 'object',
									description: 'Contains the project timeline.',
									properties: {
										phases: {
											type: 'array',
											items: {
												type: 'object',
												properties: {
													phase: { type: 'string' },
													activities: {
														type: 'array',
														items: { type: 'string' },
													},
												},
												required: [ 'phase', 'activities' ],
											},
										},
									},
									required: [ 'phases' ],
								},
								campaignId: {
									type: 'string',
									description: 'ID of the campaign to update',
								},
							},
							required: [ 'roadmapTimeline', 'campaignId' ],
						},
					},
					executor: this.processRoadmapTimelineExecutor.bind(this),
				},

				// Tool para KPI Framework
				{
					type: 'function',
					function: {
						name: 'processKpiFramework',
						description: 'Processes and stores the Key Performance Indicator (KPI) framework for measuring campaign success.',
						parameters: {
							type: 'object',
							properties: {
								kpiFramework: {
									type: 'object',
									description: 'Contains the KPIs for the campaign.',
									properties: {
										awareness: { type: 'array', items: { type: 'string' } },
										engagement: { type: 'array', items: { type: 'string' } },
										conversion: { type: 'array', items: { type: 'string' } },
										sentiment: { type: 'array', items: { type: 'string' } },
									},
									required: [ 'awareness', 'engagement', 'conversion', 'sentiment' ],
								},
								campaignId: {
									type: 'string',
									description: 'ID of the campaign to update',
								},
							},
							required: [ 'kpiFramework', 'campaignId' ],
						},
					},
					executor: this.processKpiFrameworkExecutor.bind(this),
				},

				// Tool para Interaction Log
				{
					type: 'function',
					function: {
						name: 'logInteraction',
						description: 'Logs an interaction event (e.g., user action, AI suggestion) within the campaign development process.',
						parameters: {
							type: 'object',
							properties: {
								interactionLogEntry: {
									type: 'object',
									description: 'A single entry for the interaction log.',
									properties: {
										timestamp: {
											type: 'string',
											description: 'Timestamp of the interaction (ISO format preferred).',
										},
										type: {
											type: 'string',
											description: 'Type of interaction (e.g., MIA_Suggestion, User_Action).',
										},
										content: {
											type: 'string',
											description: 'Details of the interaction.',
										},
									},
									required: [ 'timestamp', 'type', 'content' ],
								},
								campaignId: {
									type: 'string',
									description: 'ID of the campaign to update',
								},
							},
							required: [ 'interactionLogEntry', 'campaignId' ],
						},
					},
					executor: this.logInteractionExecutor.bind(this),
				},

				// Tool para Generate Campaign Cover Image
				{
					type: 'function',
					function: {
						name: 'generateAndSaveCampaignCoverImage',
						description: 'Generates a cover image based on a text prompt using an image generation model (like DALL-E) via AIService.generateCoverImage, uploads it, and associates the resulting image URL as the cover image for a specific campaign ID.',
						parameters: {
							type: 'object',
							properties: {
								campaignId: {
									type: 'string',
									description: 'The unique identifier of the campaign to which this cover image should be attached.',
								},
								prompt: {
									type: 'string',
									description: 'The detailed text prompt describing the desired cover image. Should be suitable for an image generation model.',
								},
								imageOptions: {
									type: 'object',
									description: 'Optional parameters for image generation (e.g., size, model). Uses defaults if not provided.',
									properties: {
										size: {
											type: 'string',
											description: 'Desired image size (e.g., \'1024x1024\', \'512x512\'). Default: \'512x512\'.',
										},
										model: {
											type: 'string',
											description: 'Image generation model (e.g., \'dall-e-2\', \'dall-e-3\'). Default: \'dall-e-2\'.',
										},
										n: {
											type: 'integer',
											description: 'Number of images to generate. Default: 1.',
										},
										responseFormat: {
											type: 'string',
											enum: [ 'url', 'b64_json' ],
											description: 'Format of the response. Default: \'url\'.',
										},
									},
									required: [],
								},
							},
							required: [ 'campaignId', 'prompt' ],
						},
					},
					executor: this.generateAndSaveCampaignCoverImageExecutor.bind(this),
				},
			];

			// Resto del código de validación...

			// Prepare for SSE
			res.writeHead(200, {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
			});

			const sendSSE = (data) => {
				res.write(`data: ${ JSON.stringify(data) }\n\n`);
			};

			// Save user message to chat history
			await PrimateService.create('message', {
				idUser: userId,
				idChat,
				idThread,
				role: 'user',
				text: prompt,
				metas: { url },
			});

			// Get message history and context
			const { messages, context } = await MessageService.getHistory(idChat, idThread);
			this.logger.info(`Loaded ${ messages.length } messages from history`);

			// Prepare system prompt with context and agent info if available
			let systemPrompt = system || 'You are a helpful assistant.';

			if(context) {
				systemPrompt += `\n\n#Context:\n${ JSON.stringify(context) }\n\n`;
			}

			if(agent) {
				systemPrompt += `\n\n#Agent current information:\n${ JSON.stringify(agent) }\n\n`;
			}

			if(idCampaign) systemPrompt += `\n\n#Campaign ID: ${ idCampaign }\n\n`;

			// First check if there are any tool calls needed
			let toolResults = {};  // Cambiado de array a objeto para facilitar el acceso
			if(tools.length > 0 && executeTools) {
				this.logger.info('Checking for required tool calls...');

				try {
					// Make a non-streaming call to check for tool calls
					const toolCheckResponse = await this.sendMessage({
						model,
						system: systemPrompt,
						prompt,
						history: messages,
						tools,
						toolChoice: 'auto',
						stream: false,
					});

					// Extract and process any tool calls
					const toolCalls = toolCheckResponse.choices?.[0]?.message?.tool_calls;
					if(toolCalls && toolCalls.length > 0) {
						this.logger.info(`Found ${ toolCalls.length } tool calls to execute`);

						// Execute the tools
						const toolResultsArray = await this.executeToolCalls(toolCalls, tools);

						// Convertir el array de resultados en un objeto para acceso más fácil
						toolResultsArray.forEach(result => {
							if(result.status === 'success') {
								toolResults[result.name] = result.result;
							} else {
								toolResults[result.name] = { error: result.error };
							}
						});

						// Send tool results to client
						for(const result of toolResultsArray) {
							sendSSE({ type: 'tool', data: result });
						}

						// Enhance system prompt with tool results
						const toolResultsText = toolResultsArray.map(call =>
							`- ${ call.name }: ${ JSON.stringify(call.arguments) } -> ${ JSON.stringify(call.result) }`,
						).join('\n');

						systemPrompt += `\n\n#Function calls:\n${ toolResultsText }\n\n`;
						systemPrompt += `Answer the user based on the information from the function calls above.`;
					}
				} catch(toolError) {
					this.logger.error('Error checking for tool calls:', toolError);
					// Continue without tool execution on error
				}
			}

			// Now make the streaming API call for the actual response
			const response = await this.sendMessage({
				model,
				system: systemPrompt,
				prompt,
				history: messages,
				stream: true,
			});

			// Process the streaming response - versión modificada que maneja el mensaje completo
			await this.processStreamingResponse(
				response.data,
				this.solveModelInfo(model).provider,
				sendSSE,
				async (fullMessage) => {
					// 0) Si no viene fullMessage, cerramos:
					if(!fullMessage) {
						return setTimeout(() => res.end(), 500);
					}

					// 1) Guardar el mensaje y contexto:
					try {
						const updatedContext = await this.extractContext(prompt, fullMessage, context);
						await PrimateService.create('message', {
							idUser: userId,
							idChat,
							idThread,
							role: 'assistant',
							text: fullMessage,
							metas: {
								url,
								context: { ...context, ...updatedContext },
								toolResults: Object.keys(toolResults).length
									? JSON.stringify(toolResults)
									: undefined,
							},
						});
						this.logger.info('Response saved to chat history with updated context');
					} catch(err) {
						this.logger.error('Error saving response or updating context:', err);
						// No abortamos, seguimos para enviar la campaña
					}

					// 2) Parsear y emitir la parte “response”
					let parsed;
					try {
						parsed = JSON.parse(fullMessage);
						sendSSE({ type: 'response', data: parsed.data });
					} catch(err) {
						sendSSE({
							type: 'error',
							error: 'No se pudo parsear la porción data de la respuesta',
							details: err.message,
							raw: fullMessage,
						});
						// Aún así intentamos enviar la campaña abajo
					}

					// 3) Traer y emitir la campaña completa
					try {
						const campaign = await PrimateService.prisma.campaign.findUnique({
							where: { id: idCampaign },
						});
						if(campaign) {
							sendSSE({ type: 'campaign', data: campaign });
						} else {
							sendSSE({
								type: 'warning',
								message: `Campaña ${ idCampaign } no encontrada`,
							});
						}
					} catch(err) {
						sendSSE({
							type: 'error',
							error: 'Error al consultar la campaña',
							details: err.message,
						});
					}

					// 4) Finalmente, cerramos el stream **una sola vez**
					setTimeout(() => res.end(), 500);
				},
				toolResults,  // Pasar los resultados de las herramientas
			);

		} catch(error) {
			this.logger.error('Error in AI message handler:', error);
			// Try to send an error response if possible
			try {
				res.write(`data: ${ JSON.stringify({
					type: 'error',
					error: error.message || 'Internal server error',
				}) }\n\n`);
			} catch(writeError) {
				this.logger.error('Error sending error response:', writeError);
			}
			res.end();
		}

		this.logger.exit(functionName);
	}

	static async webSearch(params) {
		const functionName = 'webSearch';
		this.logger.entry(functionName, { params });

		try {
			const { query } = params;

			if(!query) {
				this.logger.error('Missing required parameter: query', {});
				return {
					error: 'Missing required parameter: query',
				};
			}

			this.logger.info(`Executing web search for query: ${ query }`);

			// Configuración de la solicitud para la API responses
			const requestData = {
				model: 'gpt-4.1',
				tools: [
					{
						type: 'web_search_preview',
					},
				],
				input: query,
			};

			const headers = {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${ process.env.OPENAI_API_KEY }`,
			};

			// Realizar la solicitud
			const response = await axios.post('https://api.openai.com/v1/responses', requestData, { headers });

			// Procesar la respuesta de manera correcta
			let searchResults = '';

			// La respuesta puede ser un objeto, no un array, verifica la estructura
			this.logger.debug('Response structure:', response.data);

			// Extraer el contenido de la respuesta
			if(response.data && Array.isArray(response.data)) {
				// Si es un array, busca el mensaje
				const messageItem = response.data.find(item => item.type === 'message');
				if(messageItem && messageItem.content && messageItem.content.length > 0) {
					searchResults = messageItem.content[0].text || 'No results found.';
				}
			} else if(response.data && response.data.content) {
				// Si es un objeto con content
				searchResults = response.data.content;
			} else if(response.data && response.data.choices) {
				// Si es formato chat completions
				searchResults = response.data.choices[0]?.message?.content || 'No results found.';
			} else {
				// Si no se puede extraer el contenido, usa la respuesta completa
				searchResults = JSON.stringify(response.data);
			}

			this.logger.info(`Web search completed`, { resultLength: searchResults.length });
			this.logger.debug('Search results preview:', { preview: searchResults.substring(0, 100) + '...' });

			const result = {
				query,
				results: searchResults,
				timestamp: new Date().toISOString(),
			};

			this.logger.exit(functionName, { success: true, resultsLength: searchResults.length });
			return result;

		} catch(error) {
			this.logger.error(`Error executing web search:`, error);
			this.logger.exit(functionName, { error: true });

			return {
				error: 'Failed to execute web search',
				message: error.message,
			};
		}
	}

	static async generateCoverImage(prompt, options = {}) {
		const {
			size = '1024x1024',
			model = 'gpt-image-1',
			n = 1,
			quality = 'high',
		} = options;

		if(!prompt) {
			throw new Error('Prompt de imagen requerido');
		}

		try {
			console.log('🚀 [AIService] Iniciando generación de imagen...');
			console.log('📝 Prompt:', prompt);
			console.log('🛠️ Opciones:', { size, model, n, quality });

			// Import OpenAI client
			const OpenAI = (await import('openai')).default;

			// Initialize OpenAI client
			console.log('🔑 [AIService] Inicializando cliente OpenAI...');
			const openai = new OpenAI({
				apiKey: process.env.OPENAI_API_KEY,
			});

			console.log('📡 [AIService] Enviando solicitud a OpenAI API...');
			const startTime = Date.now();

			// Generate image with format parameter
			const response = await openai.images.generate({
				model,
				prompt,
				n,
				size,
				quality,
			});

			const endTime = Date.now();

			console.log('✅ [AIService] Respuesta recibida desde OpenAI en', endTime - startTime, 'ms');
			console.log('📦 Respuesta recibida (no mostrando base64 por longitud)');

			// Extract image data from response
			if(!response.data || response.data.length === 0) {
				console.error('❌ [AIService] No se recibieron datos de imagen');
				throw new Error('No se recibieron datos de imagen de OpenAI');
			}

			// Get the base64 data
			const image_base64 = response.data[0].b64_json;

			if(!image_base64) {
				console.error('❌ [AIService] No se encontró contenido base64 en la respuesta', response.data[0]);
				throw new Error('No se pudo extraer los datos base64 de la imagen generada');
			}

			console.log('🖼️ Imagen recibida en formato base64');

			// Convert base64 to buffer
			const image_bytes = Buffer.from(image_base64, 'base64');

			console.log('☁️ Subiendo imagen a DigitalOcean Spaces...');

			// Upload image buffer directly instead of URL
			const attachment = await UploadService.createAttachmentFromBuffer(image_bytes, {
				acl: 'public-read',
				contentType: 'image/png',
				fileName: `ai-generated-${ Date.now() }.png`,
				metas: {
					openaiModel: model,
					openaiSize: size,
					openaiQuality: quality,
					openaiPrompt: prompt,
					openaiResponseTime: endTime - startTime,
				},
			});

			console.log('🎉 Imagen subida exitosamente:', attachment.url);

			return attachment;

		} catch(error) {
			console.error('❌ [AIService] Error generando imagen:', error);

			// Enhanced error logging
			if(error.response?.data?.error) {
				console.error('❌ Error específico de OpenAI:', error.response.data.error);
			}

			console.error('❌ Detalles del error:', {
				message: error.message,
				stack: error.stack,
				status: error.status || error.response?.status || 'No status code',
				responseData: error.response?.data || 'No response data',
			});

			throw new Error('Error generando cover image: ' + error.message);
		}
	}

	/**
	 * Executor function for processChannelPlan tool
	 * Updates the channelPlan key in campaign metas
	 */
	static async processChannelPlanExecutor(args) {
		const functionName = 'processChannelPlanExecutor';
		this.logger.entry(functionName, { args });

		try {
			// Extract data
			const { channelPlan } = args;
			const campaignId = args.campaignId || args.idCampaign;

			if(!channelPlan) {
				this.logger.error('Missing required channel plan data', {});
				throw new Error('Missing required channel plan data');
			}

			if(!campaignId) {
				this.logger.error('Missing required campaignId', {});
				throw new Error('Missing required campaignId');
			}

			// Get current campaign data
			const campaign = await PrimateService.prisma.campaign.findUnique({
				where: { id: parseInt(campaignId) },
				select: { metas: true },
			});

			if(!campaign) {
				throw new Error(`Campaign with ID ${ campaignId } not found`);
			}

			// Get current metas or initialize empty object
			const currentMetas = campaign.metas || {};

			// Update metas with channelPlan
			const updatedMetas = {
				...currentMetas,
				channelPlan: channelPlan,
			};

			// Update campaign
			await PrimateService.prisma.campaign.update({
				where: { id: parseInt(campaignId) },
				data: { metas: updatedMetas },
			});

			this.logger.info(`Channel plan updated for campaign ${ campaignId }`);
			this.logger.exit(functionName, { success: true });

			return {
				success: true,
				campaignId,
				message: 'Channel plan successfully updated',
				data: channelPlan,
			};

		} catch(error) {
			this.logger.error(`Error executing channel plan processing:`, error);
			this.logger.exit(functionName, { error: true });

			throw error;
		}
	}

	/**
	 * Executor function for processExecutionAssets tool
	 * Updates the executionAssets key in campaign metas
	 */
	static async processExecutionAssetsExecutor(args) {
		const functionName = 'processExecutionAssetsExecutor';
		this.logger.entry(functionName, { args });

		try {
			// Extract data
			const { executionAssets } = args;
			const campaignId = args.campaignId || args.idCampaign;

			if(!executionAssets) {
				this.logger.error('Missing required execution assets data', {});
				throw new Error('Missing required execution assets data');
			}

			if(!campaignId) {
				this.logger.error('Missing required campaignId', {});
				throw new Error('Missing required campaignId');
			}

			// Get current campaign data
			const campaign = await PrimateService.prisma.campaign.findUnique({
				where: { id: parseInt(campaignId) },
				select: { metas: true },
			});

			if(!campaign) {
				throw new Error(`Campaign with ID ${ campaignId } not found`);
			}

			// Get current metas or initialize empty object
			const currentMetas = campaign.metas || {};

			// Update metas with executionAssets
			const updatedMetas = {
				...currentMetas,
				executionAssets: executionAssets,
			};

			// Update campaign
			await PrimateService.prisma.campaign.update({
				where: { id: parseInt(campaignId) },
				data: { metas: updatedMetas },
			});

			this.logger.info(`Execution assets updated for campaign ${ campaignId }`);
			this.logger.exit(functionName, { success: true });

			return {
				success: true,
				campaignId,
				message: 'Execution assets successfully updated',
				data: executionAssets,
			};

		} catch(error) {
			this.logger.error(`Error executing execution assets processing:`, error);
			this.logger.exit(functionName, { error: true });

			throw error;
		}
	}

	/**
	 * Executor function for processBudgetOutline tool
	 * Updates the budgetOutline key in campaign metas
	 */
	static async processBudgetOutlineExecutor(args) {
		const functionName = 'processBudgetOutlineExecutor';
		this.logger.entry(functionName, { args });

		try {
			// Extract data
			const { budgetOutline } = args;
			const campaignId = args.campaignId || args.idCampaign;

			if(!budgetOutline) {
				this.logger.error('Missing required budget outline data', {});
				throw new Error('Missing required budget outline data');
			}

			if(!campaignId) {
				this.logger.error('Missing required campaignId', {});
				throw new Error('Missing required campaignId');
			}

			// Get current campaign data
			const campaign = await PrimateService.prisma.campaign.findUnique({
				where: { id: parseInt(campaignId) },
				select: { metas: true },
			});

			if(!campaign) {
				throw new Error(`Campaign with ID ${ campaignId } not found`);
			}

			// Get current metas or initialize empty object
			const currentMetas = campaign.metas || {};

			// Update metas with budgetOutline
			const updatedMetas = {
				...currentMetas,
				budgetOutline: budgetOutline,
			};

			// Update campaign
			await PrimateService.prisma.campaign.update({
				where: { id: parseInt(campaignId) },
				data: { metas: updatedMetas },
			});

			this.logger.info(`Budget outline updated for campaign ${ campaignId }`);
			this.logger.exit(functionName, { success: true });

			return {
				success: true,
				campaignId,
				message: 'Budget outline successfully updated',
				data: budgetOutline,
			};

		} catch(error) {
			this.logger.error(`Error executing budget outline processing:`, error);
			this.logger.exit(functionName, { error: true });

			throw error;
		}
	}

	/**
	 * Executor function for processRoadmapTimeline tool
	 * Updates the roadmapTimeline key in campaign metas
	 */
	static async processRoadmapTimelineExecutor(args) {
		const functionName = 'processRoadmapTimelineExecutor';
		this.logger.entry(functionName, { args });

		try {
			// Extract data
			const { roadmapTimeline } = args;
			const campaignId = args.campaignId || args.idCampaign;

			if(!roadmapTimeline) {
				this.logger.error('Missing required roadmap timeline data', {});
				throw new Error('Missing required roadmap timeline data');
			}

			if(!campaignId) {
				this.logger.error('Missing required campaignId', {});
				throw new Error('Missing required campaignId');
			}

			// Get current campaign data
			const campaign = await PrimateService.prisma.campaign.findUnique({
				where: { id: parseInt(campaignId) },
				select: { metas: true },
			});

			if(!campaign) {
				throw new Error(`Campaign with ID ${ campaignId } not found`);
			}

			// Get current metas or initialize empty object
			const currentMetas = campaign.metas || {};

			// Update metas with roadmapTimeline
			const updatedMetas = {
				...currentMetas,
				roadmapTimeline: roadmapTimeline,
			};

			// Update campaign
			await PrimateService.prisma.campaign.update({
				where: { id: parseInt(campaignId) },
				data: { metas: updatedMetas },
			});

			this.logger.info(`Roadmap timeline updated for campaign ${ campaignId }`);
			this.logger.exit(functionName, { success: true });

			return {
				success: true,
				campaignId,
				message: 'Roadmap timeline successfully updated',
				data: roadmapTimeline,
			};

		} catch(error) {
			this.logger.error(`Error executing roadmap timeline processing:`, error);
			this.logger.exit(functionName, { error: true });

			throw error;
		}
	}

	/**
	 * Executor function for processKpiFramework tool
	 * Updates the kpiFramework key in campaign metas
	 */
	static async processKpiFrameworkExecutor(args) {
		const functionName = 'processKpiFrameworkExecutor';
		this.logger.entry(functionName, { args });

		try {
			// Extract data
			const { kpiFramework } = args;
			const campaignId = args.campaignId || args.idCampaign;

			if(!kpiFramework) {
				this.logger.error('Missing required KPI framework data', {});
				throw new Error('Missing required KPI framework data');
			}

			if(!campaignId) {
				this.logger.error('Missing required campaignId', {});
				throw new Error('Missing required campaignId');
			}

			// Get current campaign data
			const campaign = await PrimateService.prisma.campaign.findUnique({
				where: { id: parseInt(campaignId) },
				select: { metas: true },
			});

			if(!campaign) {
				throw new Error(`Campaign with ID ${ campaignId } not found`);
			}

			// Get current metas or initialize empty object
			const currentMetas = campaign.metas || {};

			// Update metas with kpiFramework
			const updatedMetas = {
				...currentMetas,
				kpiFramework: kpiFramework,
			};

			// Update campaign
			await PrimateService.prisma.campaign.update({
				where: { id: parseInt(campaignId) },
				data: { metas: updatedMetas },
			});

			this.logger.info(`KPI framework updated for campaign ${ campaignId }`);
			this.logger.exit(functionName, { success: true });

			return {
				success: true,
				campaignId,
				message: 'KPI framework successfully updated',
				data: kpiFramework,
			};

		} catch(error) {
			this.logger.error(`Error executing KPI framework processing:`, error);
			this.logger.exit(functionName, { error: true });

			throw error;
		}
	}

	/**
	 * Executor function for logInteraction tool
	 * Updates or appends to the interactionLog array in campaign metas
	 */
	static async logInteractionExecutor(args) {
		const functionName = 'logInteractionExecutor';
		this.logger.entry(functionName, { args });

		try {
			// Extract data
			const { interactionLogEntry } = args;
			const campaignId = args.campaignId || args.idCampaign;

			if(!interactionLogEntry) {
				this.logger.error('Missing required interaction log entry data', {});
				throw new Error('Missing required interaction log entry data');
			}

			if(!campaignId) {
				this.logger.error('Missing required campaignId', {});
				throw new Error('Missing required campaignId');
			}

			// Get current campaign data
			const campaign = await PrimateService.prisma.campaign.findUnique({
				where: { id: parseInt(campaignId) },
				select: { metas: true },
			});

			if(!campaign) {
				throw new Error(`Campaign with ID ${ campaignId } not found`);
			}

			// Get current metas or initialize empty object
			const currentMetas = campaign.metas || {};

			// Get current interaction log or initialize empty array
			const currentInteractionLog = currentMetas.interactionLog || [];

			// Ensure timestamp exists
			if(!interactionLogEntry.timestamp) {
				interactionLogEntry.timestamp = new Date().toISOString();
			}

			// Add new entry to the log
			const updatedInteractionLog = [ ...currentInteractionLog, interactionLogEntry ];

			// Update metas with updated interaction log
			const updatedMetas = {
				...currentMetas,
				interactionLog: updatedInteractionLog,
			};

			// Update campaign
			await PrimateService.prisma.campaign.update({
				where: { id: parseInt(campaignId) },
				data: { metas: updatedMetas },
			});

			this.logger.info(`Interaction log updated for campaign ${ campaignId }`);
			this.logger.exit(functionName, { success: true });

			return {
				success: true,
				campaignId,
				message: 'Interaction log successfully updated',
				entry: interactionLogEntry,
			};

		} catch(error) {
			this.logger.error(`Error executing interaction log processing:`, error);
			this.logger.exit(functionName, { error: true });

			throw error;
		}
	}

	/**
	 * Executor function for generateAndSaveCampaignCoverImage tool
	 * Generates a cover image and saves it directly to the coverImage field of the campaign
	 */
	static async generateAndSaveCampaignCoverImageExecutor(args) {
		const functionName = 'generateAndSaveCampaignCoverImageExecutor';
		this.logger.entry(functionName, { args });

		try {
			// Extract parameters
			const { campaignId, prompt, imageOptions } = args;

			if(!campaignId) {
				this.logger.error('Missing required parameter: campaignId', {});
				throw new Error('Missing required parameter: campaignId is required');
			}

			if(!prompt) {
				this.logger.error('Missing required parameter: prompt', {});
				throw new Error('Missing required parameter: prompt is required');
			}

			// Call the image generation service
			const imageAttachment = await this.generateCoverImage(prompt, imageOptions || {});

			if(!imageAttachment || !imageAttachment.url) {
				throw new Error('Failed to generate or upload image');
			}

			// Update the campaign with the new cover image URL directly in the coverImage field
			await PrimateService.prisma.campaign.update({
				where: { id: parseInt(campaignId) },
				data: {
					coverImage: imageAttachment.url,
				},
			});

			this.logger.info(`Cover image generated and saved for campaign ${ campaignId }`);
			this.logger.exit(functionName, { success: true, imageUrl: imageAttachment.url });

			return {
				success: true,
				campaignId,
				imageUrl: imageAttachment.url,
				message: 'Cover image generated and saved successfully',
			};

		} catch(error) {
			this.logger.error(`Error generating and saving campaign cover image:`, error);
			this.logger.exit(functionName, { error: true });

			throw error;
		}
	}
}

export default AIService;
