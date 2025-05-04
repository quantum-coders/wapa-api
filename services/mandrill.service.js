import mailchimpTx from '@mailchimp/mailchimp_transactional';
import 'dotenv/config';

const mailchimp = mailchimpTx(process.env.MANDRILL_API_KEY);

class MandrillService {
	static async ping() {
		try {
			const response = await mailchimp.users.ping();
			console.info('Mandrill API Response:', response);
			return response;
		} catch(error) {
			console.error('Error pinging Mandrill API:', error);
			throw error;
		}
	}

	static async addSenderDomain(domain) {
		try {
			const response = await mailchimp.senders.addDomain({ domain });
			console.info('Add Sender Domain Response:', response);
			return response;
		} catch(error) {
			console.error('Error adding sender domain:', error);
			throw error;
		}
	}

	static async listSenderDomains() {
		try {
			const response = await mailchimp.senders.domains();
			console.info('List Sender Domains Response:', response);
			return response;
		} catch(error) {
			console.error('Error listing sender domains:', error);
			throw error;
		}
	}

	static async checkDomainSettings(domain) {
		try {
			const response = await mailchimp.senders.checkDomain({ domain });
			console.info('Check Domain Settings Response:', response);
			return response;
		} catch(error) {
			console.error('Error checking domain settings:', error);
			throw error;
		}
	}

	static async verifyDomain(domain, mailbox) {
		try {
			const response = await mailchimp.senders.verifyDomain({
				domain,
				mailbox,
			});
			console.info('Verify Domain Response:', response);
			return response;
		} catch(error) {
			console.error('Error verifying domain:', error);
			throw error;
		}
	}

	static async getIpInfo() {
		try {
			const response = await mailchimp.ips.info();
			console.info('Get IP Info Response:', response);
			return response;
		} catch(error) {
			console.error('Error getting IP info:', error);
			throw error;
		}
	}

	static async requestAdditionalIp() {
		try {
			const response = await mailchimp.ips.provision();
			console.info('Request Additional IP Response:', response);
			return response;
		} catch(error) {
			console.error('Error requesting additional IP:', error);
			throw error;
		}
	}

	static async startIpWarmup(ip) {
		try {
			const response = await mailchimp.ips.startWarmup({ ip });
			console.info('Start IP Warmup Response:', response);
			return response;
		} catch(error) {
			console.error('Error starting IP warmup:', error);
			throw error;
		}
	}

	static async moveIpToDifferentPool(ip, pool) {
		try {
			const response = await mailchimp.ips.setPool({ ip, pool });
			console.info('Move IP to Different Pool Response:', response);
			return response;
		} catch(error) {
			console.error('Error moving IP to different pool:', error);
			throw error;
		}
	}

	static async listIpPools() {
		try {
			const response = await mailchimp.ips.listPools();
			console.info('List IP Pools Response:', response);
			return response;
		} catch(error) {
			console.error('Error listing IP pools:', error);
			throw error;
		}
	}

	static async sendMessage(message) {
		try {
			return await mailchimp.messages.send({ message });
		} catch(error) {
			console.error('Error sending message:', error);
			throw error;
		}
	}

	static async sendMessageUsingTemplate(templateName, templateContent, message) {
		try {
			const response = await mailchimp.messages.sendTemplate({
				template_name: templateName,
				template_content: templateContent,
				message,
			});
			console.info('Send Message Using Template Response:', response);
			return response;
		} catch(error) {
			console.error('Error sending message using template:', error);
			throw error;
		}
	}

	static async getMessageInfo(id) {
		try {
			const response = await mailchimp.messages.info({ id });
			console.info('Get Message Info Response:', response);
			return response;
		} catch(error) {
			console.error('Error getting message info:', error);
			throw error;
		}
	}

	static async createTemplate(name, fromEmail, subject, code) {
		try {
			const response = await mailchimp.templates.add({
				name,
				from_email: fromEmail,
				subject,
				code,
			});
			console.info('Create Template Response:', response);
			return response;
		} catch(error) {
			console.error('Error creating template:', error);
			throw error;
		}
	}

	static async listTemplates() {
		try {
			const response = await mailchimp.templates.list();
			console.info('List Templates Response:', response);
			return response;
		} catch(error) {
			console.error('Error listing templates:', error);
			throw error;
		}
	}

	static async deleteTemplate(name) {
		try {
			const response = await mailchimp.templates.delete({ name });
			console.info('Delete Template Response:', response);
			return response;
		} catch(error) {
			console.error('Error deleting template:', error);
			throw error;
		}
	}

	// Método para obtener estadísticas detalladas sobre los mensajes enviados
	static async getMessageStats() {
		try {
			const response = await mailchimp.messages.search();
			console.info('Get Message Stats Response:', response);
			return response;
		} catch(error) {
			console.error('Error getting message stats:', error);
			throw error;
		}
	}

	// Métodos para la gestión de Webhooks
	static async createWebhook(url, events) {
		try {
			const response = await mailchimp.webhooks.add({ url, events });
			console.info('Create Webhook Response:', response);
			return response;
		} catch(error) {
			console.error('Error creating webhook:', error);
			throw error;
		}
	}

	static async listWebhooks() {
		try {
			const response = await mailchimp.webhooks.list();
			console.info('List Webhooks Response:', response);
			return response;
		} catch(error) {
			console.error('Error listing webhooks:', error);
			throw error;
		}
	}

	static async deleteWebhook(id) {
		try {
			const response = await mailchimp.webhooks.delete({ id });
			console.info('Delete Webhook Response:', response);
			return response;
		} catch(error) {
			console.error('Error deleting webhook:', error);
			throw error;
		}
	}
}

export default MandrillService;
