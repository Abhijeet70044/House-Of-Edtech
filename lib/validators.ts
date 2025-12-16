import { z } from "zod";

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2).max(80),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export const itemSchema = z.object({
  name: z.string().min(2).max(120),
  sku: z.string().min(2).max(80),
  quantity: z.coerce.number().int().min(0),
  category: z.string().max(80).optional().nullable(),
  location: z.string().max(80).optional().nullable(),
  minStock: z.coerce.number().int().min(0).default(0),
  notes: z.string().max(240).optional().nullable(),
  status: z.enum(["ACTIVE", "DISCONTINUED"]).default("ACTIVE"),
});

export const itemUpdateSchema = itemSchema.partial();

