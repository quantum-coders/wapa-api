import 'dotenv/config';
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
				session: process.env.WAHA_SESSION,
			};

			const headers = { 'X-Api-Key': process.env.WAHA_API_KEY };

			const response = await axios.post(url, payload, { headers });
			return response.data;
		} catch(error) {
			console.error('Error sending WhatsApp message:', error);
			throw error;
		}
	}

	static async sendImage(to, imageUrl, caption) {
		try {
			const url = process.env.WAHA_API_URL + '/sendImage';

			console.log(url);
			console.log(imageUrl.substring(imageUrl.lastIndexOf('/') + 1));

			const payload = {
				chatId: to,
				file: {
					mimetype: 'image/png',
					filename: imageUrl.substring(imageUrl.lastIndexOf('/') + 1),
					url: imageUrl,
				},
				reply_to: null,
				caption: caption || '',
				session: process.env.WAHA_SESSION,
			};

			const headers = { 'X-Api-Key': process.env.WAHA_API_KEY };

			const response = await axios.post(url, payload, { headers });
			return response.data;
		} catch(error) {
			console.error('Error sending WhatsApp image:', error);
			throw error;
		}
	}
}

export default WahaService;