import primate from '@thewebchimp/primate';

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
}

export default ToolService;