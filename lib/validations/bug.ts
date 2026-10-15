import { z } from "zod";
import { isHttpUrl, splitProofLinkLines } from "@/lib/proof-links";

export const severities = ["low", "medium", "high", "critical"] as const;
export const statuses = ["open", "in_progress", "resolved", "closed"] as const;

export const severitySchema = z.enum(severities);
export const statusSchema = z.enum(statuses);

const MAX_PROOF_LINKS = 20;

/** Optional newline-separated http(s) URLs for screenshots / videos. */
export const proofLinksInputSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    const links = splitProofLinkLines(value);
    if (links.length > MAX_PROOF_LINKS) {
      ctx.addIssue({
        code: "custom",
        message: `At most ${MAX_PROOF_LINKS} proof links`,
      });
      return z.NEVER;
    }
    for (const link of links) {
      if (!isHttpUrl(link)) {
        ctx.addIssue({
          code: "custom",
          message: `Each proof link must be a valid http(s) URL (got: ${link})`,
        });
        return z.NEVER;
      }
    }
    return links;
  });

export const createBugSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(5000),
  severity: severitySchema.default("medium"),
  assigneeId: z.string().cuid().optional().or(z.literal("")),
  proofLinks: proofLinksInputSchema,
});

export const updateBugSchema = z.object({
  status: statusSchema.optional(),
  assigneeId: z.string().cuid().nullable().optional().or(z.literal("")),
  severity: severitySchema.optional(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100),
    email: z
      .string()
      .trim()
      .email("Enter a valid email")
      .transform((value) => value.toLowerCase()),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
