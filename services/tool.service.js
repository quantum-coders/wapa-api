import primate from '@thewebchimp/primate';
import CryptoService from '#services/crypto.service.js';

class ToolService {

	static async changeEmail(funcArgs) {
		try {

			const user = await primate.prisma.user.findFirst({ where: { idWa: funcArgs.idWa } });
			if(!user) throw new Error('User not found');

			// update user
			return await primate.prisma.user.update({
				where: { id: user.id },
				data: {
					email: funcArgs.email || user.email,
				},
			});

		} catch(e) {
			throw e;
		}
	}

	static async changeNicename(funcArgs) {
		try {

			const user = await primate.prisma.user.findFirst({ where: { idWa: funcArgs.idWa } });
			if(!user) throw new Error('User not found');

			// update user
			return await primate.prisma.user.update({
				where: { id: user.id },
				data: {
					nicename: funcArgs.nicename || user.nicename,
				},
			});

		} catch(e) {
			throw e;
		}
	}

	static async getWalletBalance(funcArgs) {
		try {

			const user = await primate.prisma.user.findFirst({ where: { idWa: funcArgs.idWa } });
			if(!user) throw new Error('User not found');

			// get the wallet

			return await CryptoService.getTokenBalance(funcArgs.walletAddress, '0x82b9e52b26a2954e113f94ff26647754d5a4247d', 6);

		} catch(e) {
			throw e;
		}
	}
}

export default ToolService;