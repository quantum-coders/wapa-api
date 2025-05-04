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

	static async startTyping(to) {
		try {
			const url = process.env.WAHA_API_URL + '/startTyping';

			const payload = {
				chatId: to,
				session: process.env.WAHA_SESSION,
			};

			const headers = { 'X-Api-Key': process.env.WAHA_API_KEY };

			return axios.post(url, payload, { headers });
		} catch(error) {
			console.error('Error starting typing:', error);
			throw error;
		}
	}

	static async stopTyping(to) {
		try {
			const url = process.env.WAHA_API_URL + '/stopTyping';

			const payload = {
				chatId: to,
				session: process.env.WAHA_SESSION,
			};

			const headers = { 'X-Api-Key': process.env.WAHA_API_KEY };

			return axios.post(url, payload, { headers });
		} catch(error) {
			console.error('Error stopping typing:', error);
			throw error;
		}
	}

	static async getConversationHistory(to) {
		try {
			const url = process.env.WAHA_API_URL + `/${ process.env.WAHA_SESSION }/chats/${ to }/messages`;
			const headers = { 'X-Api-Key': process.env.WAHA_API_KEY };

			const response = await axios.get(url, { headers });
			return response.data;
		} catch(error) {
			console.error('Error getting conversation history:', error);
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