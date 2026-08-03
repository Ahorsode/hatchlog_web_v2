import { createClient } from '@supabase/supabase-js';
import * as Sentry from "@sentry/nextjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Wrapper for Supabase API calls to capture specific errors as High Priority in Sentry.
 * Captures 42501 (Permission Denied) and 500 errors.
 */
export async function safeSupabaseCall<T>(
  promise: Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  const result = await promise;

  if (result.error) {
    const errorCode = result.error.code;
    const status = result.error.status;

    // Capture specific errors as "High Priority"
    if (errorCode === '42501' || status === 500) {
      Sentry.withScope((scope) => {
        scope.setLevel('fatal');
        scope.setTag('priority', 'high');
        scope.setTag('supabase_error_code', errorCode);
        scope.setContext('supabase_error', {
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint,
        });
        
        Sentry.captureException(new Error(`Supabase Error ${errorCode || status}: ${result.error.message}`));
      });
    } else {
      // Still log other errors to Sentry but with default priority
      Sentry.captureException(result.error);
    }
  }

  return result;
}

/**
 * Example usage:
 * 
 * const { data, error } = await safeSupabaseCall(
 *   supabase.from('batches').select('*')
 * );
 */
