import 'dotenv/config';
import AIService from '#services/ai.service.js';
import WahaService from '#services/waha.service.js';
import UserService from '#entities/users/user.service.js';
import userService from '#entities/users/user.service.js';
import CryptoService from '#services/crypto.service.js';

class WhatsappService {

	static async webhookResponse(payload) {
		const from = payload.from;
		const message = payload.body;

		try {
			if(!payload.fromMe) {

				console.info('Received message from:', from);

					console.info('Message from authorized number', process.env.WHATSAPP_NUMBER);

					// Check if the user exists and store it
					let user = await UserService.verifyUserExistence(from);

					// If the user doesn't exist, register them
					if(!user) {
						console.warn('User not found, registering for the first time');

						const data = {};
						data.nicename = payload._data?.notifyName || '';

						user = await UserService.registerUserForFirstTime(from, data);
					}

					// check if the user has a wallet in the metas
					if(!user.metas.wallet) {
						const wallet = await CryptoService.generateWallet();

						// fund the wallet
						await CryptoService.fundWallet(wallet.address);

						await userService.updateUserWallet(from, { wallet });
					}

					// prepare the user data for context
					let userData = {
						nicename: user.nicename,
						email: user.email,
						wallet: user.metas.wallet || '',
					};

					// If we dont have nicename or email, we go to the onboarding service
					if(!userData.nicename || !userData.email) {
						console.warn('User data is missing, going to onboarding service');

						await WahaService.startTyping(from);
						const onboardingResponse = await AIService.onboardingConversation(message, userData);
						console.log('onboardingResponse', onboardingResponse);

						await userService.updateOnboardingData(from, onboardingResponse);
						await WahaService.sendText(from, onboardingResponse.continue_conversation);

						return null;
					}

					// =================================================================================================
					// If we have the user data, we go to the AI services that use the function calling
					// =================================================================================================

					// Prepare new user context
					userData = {
						nicename: userData.nicename,
						email: userData.email,
						wallet: userData.wallet,
					};

					// first we get the conversation history
					const history = await WahaService.getConversationHistory(from);

					await WahaService.startTyping(from);
					const tooledResponse = await AIService.tooledConversation(from, message, userData, history);
					console.log('tooledResponse', tooledResponse);

					await WahaService.sendText(from, tooledResponse);
					await WahaService.stopTyping(from);

					/*
					await WahaService.startTyping(from);
					await new Promise(resolve => setTimeout(resolve, 2000));
					await WahaService.sendText(from, 'Hola!');
					*/
			}

		} catch(error) {
			console.error('Error in webhookResponse:', error);
			await WahaService.stopTyping(from);
			throw error;
		}
	}
}

export default WhatsappService;