import 'dotenv/config';
import OpenAI from 'openai';

class OpenAIService {

	static openai;

	static init(key) {
		this.openai = new OpenAI(process.env.OPENAI_API_KEY || key);
	}

	static async sendMessage(data) {
		//region Parameters
		const {
			model = 'gpt-4o',
			frequencyPenalty = 0,
			system = null,
			prompt = null,
			messages = [],
			maxTokens = null,
			maxCompletionTokens = null,
			presencePenalty = 0,
			responseFormat = null,
			seed = null,
			stop = null,
			stream = false,
			temperature = 1,
			topP = 1,
			tools = null,
			toolChoice = null,
			parallelToolCalls = null,
		} = data;
		//endregion

		try {

			// prepare messages
			const preparedMessages = [];

			if(system) preparedMessages.push({ role: 'system', content: system });
			preparedMessages.push(...messages);
			if(prompt) preparedMessages.push({ role: 'user', content: prompt });

			const body = {
				messages: preparedMessages,
				model,
				frequency_penalty: frequencyPenalty,
				presence_penalty: presencePenalty,
				stop,
				stream,
				temperature,
				top_p: topP,
				max_tokens: 2048,
			};

			if(maxTokens) body.max_tokens = maxTokens;
			if(maxCompletionTokens) body.max_completion_tokens = maxCompletionTokens;
			if(seed) body.seed = seed;

			if(responseFormat) {
				if(responseFormat === 'json') body.response_format = { type: 'json_object' };
				else body.response_format = responseFormat;
			}

			if(tools) {
				body.tools = this.prepareTools(tools);
				if(toolChoice) body.tool_choice = toolChoice;
				if(parallelToolCalls) body.parallel_tool_calls = parallelToolCalls;
			}

			console.log('Body:', body);

			if(stream) {
				return this.openai.chat.completions.create(body);
			} else {

				const completion = await this.openai.chat.completions.create(body);

				if(tools) {
					return this.prepareToolCalls(completion.choices[0].message.tool_calls);
				}

				if(responseFormat === 'json') {
					try {
						return JSON.parse(completion.choices[0].message.content);
					} catch(e) {
						console.error('Error parsing response:', e);
						return completion.choices[0];
					}
				}

				return completion.choices[0];
			}

		} catch(error) {
			console.error('Error sending message:', error);
		}
	}

	static prepareTools(tools) {
		const preparedTools = [];

		for(const tool of Object.values(tools)) {
			preparedTools.push({
				type: 'function',
				function: tool,
			});
		}

		return preparedTools;
	}

	static prepareToolCalls(toolCalls) {
		const preparedToolCalls = [];

		for(const toolCall of toolCalls) {
			preparedToolCalls.push({
				name: toolCall.function.name,
				arguments: JSON.parse(toolCall.function.arguments),
			});
		}

		return preparedToolCalls;
	}

	static async generateEmbedding(text) {

		const embedding = await this.openai.embeddings.create({
			model: 'text-embedding-3-small',
			input: text,
			encoding_format: 'float',
		});

		return embedding.data[0].embedding;
	}
}

export default OpenAIService;