import 'dotenv/config';
//import WhatsappService from '#services/whatsapp.service.js';
import { PrimateService } from '@thewebchimp/primate';

class WhatsAppController {

	static async webhook(req, res) {
		try {

			console.log(req.body);




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