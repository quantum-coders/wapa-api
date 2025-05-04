import axios from 'axios';

class WahaService {

	static async sendText(to, message) {
		try {
			const url = process.env.WAHA_API_URL + '/sendText';

			const payload = {
				chatId: to,
				text: message,
				linkPreview: true,
				linkPreviewHighQuality: false,
				session: 'default',
			};

			const response = await axios.post(url, payload);
			return response.data;
		} catch(error) {
			console.error('Error sending WhatsApp message:', error);
			throw error;
		}
	}
}

export default WahaService;