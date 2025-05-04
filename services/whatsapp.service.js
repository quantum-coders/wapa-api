import 'dotenv/config';
import AIService from '#services/ai.service.js';
import WahaService from '#services/waha.service.js';

class WhatsappService {

	static async webhookResponse(payload) {
		if(!payload.fromMe) {
			const from = payload.from;

			if(from === process.env.WHATSAPP_NUMBER) {

				console.log(payload);

				await WahaService.startTyping(from);
				await new Promise(resolve => setTimeout(resolve, 2000));
				await WahaService.sendText(from, 'Hola!');
			}
		}

		return null;
	}
}

export default WhatsappService;