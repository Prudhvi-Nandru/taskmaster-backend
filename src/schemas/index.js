const { z } = require('zod');

const email = z.string().trim().email().max(254).transform((v) => v.toLowerCase());
const password = z.string().min(8).max(72);
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password,
});
const loginSchema = z.object({ email, password: z.string().min(1).max(72) });
const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');
const teamSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
});
const joinTeamSchema = z.object({ inviteCode: z.string().min(1) });
const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeId: z.string().optional().nullable(),
  teamId: z.string().min(1),
});
const taskUpdateSchema = taskSchema.omit({ teamId: true }).partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');
const commentSchema = z.object({ body: z.string().trim().min(1).max(5000) });
const aiSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(4000).optional(),
});

module.exports = {
  registerSchema, loginSchema, profileSchema, teamSchema, joinTeamSchema,
  taskSchema, taskUpdateSchema, commentSchema, aiSchema,
};
