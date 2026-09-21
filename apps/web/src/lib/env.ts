import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  VITE_ALLOW_SELF_SIGNUP: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(['true', 'false']).default('false'),
  ),
})

const production = import.meta.env.PROD
const rawUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (production ? '' : 'http://127.0.0.1:54321')
const rawKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (production ? '' : 'demo-publishable-key')

const parsed = envSchema.safeParse({
  VITE_SUPABASE_URL: rawUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: rawKey,
  VITE_ALLOW_SELF_SIGNUP: import.meta.env.VITE_ALLOW_SELF_SIGNUP,
})

if (!parsed.success) {
  throw new Error(
    'Verdis web environment is invalid. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
  )
}

export const env = parsed.data
export const allowSelfSignup = env.VITE_ALLOW_SELF_SIGNUP === 'true'
