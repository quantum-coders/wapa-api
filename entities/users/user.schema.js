import Joi from 'joi';

export default Joi.object({
	id: Joi.number().integer().optional(),
	uid: Joi.string().guid().optional(),
	username: Joi.string().email().optional(),
	email: Joi.string().email().optional(),
	idWa: Joi.string().required(),
	firstname: Joi.string().optional(),
	lastname: Joi.string().optional(),
	nicename: Joi.string().optional().default(''),
	password: Joi.string().optional().allow('').default(''),
	type: Joi.string().default('User'),
	status: Joi.string().default('Active'),
	language: Joi.string().default('en'),
	metas: Joi.alternatives().try(Joi.object()).default({}),
}).or('username', 'email');