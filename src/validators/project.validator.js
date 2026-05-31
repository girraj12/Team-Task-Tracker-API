import Joi from 'joi';
export const projectSchema = Joi.object({
  name: Joi.string().min(2).max(150).required(),
  description: Joi.string().allow('', null)
});
