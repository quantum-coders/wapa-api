import primate from '@thewebchimp/primate';
import CryptoService from '#services/crypto.service.js';
import UserService from '#entities/users/user.service.js';

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
			return await CryptoService.getTokenBalance(funcArgs.walletAddress, '0x82b9e52b26a2954e113f94ff26647754d5a4247d', 6);

		} catch(e) {
			throw e;
		}
	}

	static async sendMoney(funcArgs) {

		console.info('Send money function called with args:', funcArgs);

		const amount = funcArgs.amount;
		if(!amount) throw new Error('Amount is required');

		const contact = funcArgs.contact;
		if(!contact) throw new Error('Contact is required');

		const contactName = contact.name;
		if(!contactName) throw new Error('Contact name is required');

		const contactNumber = contact.phoneNumber;

		const user = await primate.prisma.user.findFirst({ where: { idWa: funcArgs.idWa } });
		if(!user) throw new Error('User not found');

		// get the balance of the user to check if it is enough
		const balance = await CryptoService.getTokenBalance(user.metas.wallet.address, '0x82b9e52b26a2954e113f94ff26647754d5a4247d', 6);
		if(balance.balance < amount) throw new Error('Insufficient balance');

		console.info('User balance:', balance);

		// Check if the recipient is a user
		let recipient = await primate.prisma.user.findFirst({ where: { idWa: contactNumber } });
		let recipientWalletAddress = null;

		console.info('Recipient:', recipient);

		if(!recipient) {
			recipient = await UserService.registerUserForFirstTime(contactNumber, { nicename: contactName });

			// generate a wallet for the new user
			const wallet = await CryptoService.generateWallet();
			await UserService.updateUserWallet(recipient, wallet);

			recipientWalletAddress = wallet.wallet.address;
		} else {
			recipientWalletAddress = recipient.metas.wallet.address;
		}

		console.info('Recipient wallet address:', recipientWalletAddress);

		// send the money
		const sendMoney = await CryptoService.sendToken(
			{
				privateKey: user.metas.wallet.privateKey,
				address: user.metas.wallet.address,
			},
			'0x82b9e52b26a2954e113f94ff26647754d5a4247d',
			recipientWalletAddress,
			amount,
			6,
		);

		console.info('Transaction result:', sendMoney);

		return { transaction: sendMoney, amount, contactName, contactNumber };
	}
}

export default ToolService;