import 'dotenv/config';
import AIService from '#services/ai.service.js';
import WahaService from '#services/waha.service.js';

class WhatsappService {

	static async aiResponse(payload) {
		if(!payload.fromMe) {

			console.log('FROM ME', payload.fromMe);

			const from = payload.from;

			console.log('NUMBER', process.env.WHATSAPP_NUMBER);

			if(from === process.env.WHATSAPP_NUMBER) {

				const response = await AIService.coolResponse(payload.body);
				const to = payload.to;

				const waMessage = await WahaService.sendText(to, response);

				console.log('WA MESSAGE', waMessage);

				if(waMessage) {
					return waMessage;
				} else {
					throw new Error('Error sending message');
				}
			}
		}
	}
}

export default WhatsappService;