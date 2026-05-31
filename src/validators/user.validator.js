import Joi from 'joi';

export const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('ADMIN','MANAGER','MEMBER').required()
});

export const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  role: Joi.string().valid('ADMIN','MANAGER','MEMBER')
}).min(1);
