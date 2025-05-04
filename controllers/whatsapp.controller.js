import 'dotenv/config';
import '#utils/typedef.js';
import WhatsappService from '#services/whatsapp.service.js';

class WhatsAppController {

	static async webhook(req, res) {
		try {

			const event = req.body.event;
			if(!event) return res.respond({ status: 400, message: 'Event not found' });
			const payload = req.body.payload;

			if(event === 'message.any') {
				const response = await WhatsappService.webhookResponse(payload);

				return res.respond({
					data: response,
					message: 'Message sent',
				});
			}

			return res.respond({
				message: 'Event not supported',
			});

		} catch(error) {
			console.error('Error in webhook:', error);
			return res.respond({
				status: 500,
				message: 'Error processing webhook',
			});
		}
	}
}

export default WhatsAppController;