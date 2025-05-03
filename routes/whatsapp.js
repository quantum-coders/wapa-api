import { auth, Primate } from '@thewebchimp/primate';
import WhatsappController from '#controllers/whatsapp.controller.js';

const router = Primate.getRouter();

router.post('/webhook', WhatsappController.webhook);

export { router };