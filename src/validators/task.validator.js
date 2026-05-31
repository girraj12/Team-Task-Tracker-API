import Joi from 'joi';

const futureDate = (value, helpers) => {
  if (new Date(value).getTime() <= Date.now()) return helpers.error('date.future');
  return value;
};

export const taskCreateSchema = Joi.object({
  projectId: Joi.number().integer().positive().allow(null),
  title: Joi.string().min(2).max(180).required(),
  description: Joi.string().allow('', null),
  priority: Joi.string().valid('LOW','MEDIUM','HIGH').default('MEDIUM'),
  assigneeId: Joi.number().integer().positive().required(),
  dueDate: Joi.date().custom(futureDate).messages({'date.future':'due_date must be a future date'}).allow(null)
});

export const taskUpdateSchema = Joi.object({
  projectId: Joi.number().integer().positive().allow(null),
  title: Joi.string().min(2).max(180),
  description: Joi.string().allow('', null),
  priority: Joi.string().valid('LOW','MEDIUM','HIGH'),
  assigneeId: Joi.number().integer().positive(),
  dueDate: Joi.date().custom(futureDate).messages({'date.future':'due_date must be a future date'}).allow(null)
}).min(1);

export const statusSchema = Joi.object({ status: Joi.string().valid('IN_PROGRESS','IN_REVIEW','DONE','BLOCKED').required() });

export const taskListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('TODO','IN_PROGRESS','IN_REVIEW','DONE','BLOCKED'),
  priority: Joi.string().valid('LOW','MEDIUM','HIGH'),
  assignee: Joi.number().integer().positive()
});
