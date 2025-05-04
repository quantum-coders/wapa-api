import 'dotenv/config';
import AIService from '#services/ai.service.js';
import WahaService from '#services/waha.service.js';

class WhatsappService {

	static async webhookResponse(payload) {
		if(!payload.fromMe) {
			const from = payload.from;

			console.log(payload);
		}

		return null;
	}
}

export default WhatsappService;