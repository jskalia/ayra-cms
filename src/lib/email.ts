import { resendAdapter } from '@payloadcms/email-resend'
import { APIError, type CollectionBeforeOperationHook } from 'payload'

/**
 * Email for the CMS (task 2.9). The only email the CMS sends is the password-reset link.
 *
 * Without an email adapter Payload writes every email, reset link included, to the server log,
 * so anyone who can read the Vercel logs could take over an account. So: real email through
 * Resend when RESEND_API_KEY and EMAIL_FROM are both set; otherwise password resets are refused
 * outright (no token is made, nothing is logged) and an admin sets a new password instead.
 */
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim())

export const emailAdapter = () =>
  emailConfigured()
    ? resendAdapter({
        apiKey: process.env.RESEND_API_KEY!.trim(),
        defaultFromAddress: process.env.EMAIL_FROM!.trim(),
        defaultFromName: process.env.EMAIL_FROM_NAME?.trim() || 'Ayra CMS',
      })
    : undefined

export const resetsNeedEmail: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation === 'forgotPassword' && !emailConfigured()) {
    throw new APIError('Password reset by email is off until the CMS has email. Ask an admin to set a new password.', 403, undefined, true)
  }
  return args
}
