import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

/**
 * Minimal Supabase Admin API client. Only what we need: deleting a user's auth account. This call
 * requires the service-role key, so it must only ever run on the server (this API), never in the
 * browser. The key is read from SUPABASE_SERVICE_ROLE_KEY.
 */
@Injectable()
export class SupabaseAdminService {
  private readonly log = new Logger(SupabaseAdminService.name);

  private config(): { url: string; serviceKey: string } {
    const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    if (!url || !serviceKey)
      throw new ServiceUnavailableException(
        'Deleting an account is not enabled on this deployment (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set).',
      );
    return { url, serviceKey };
  }

  /**
   * Deletes the Supabase auth user. A missing user (already gone) is treated as success so the
   * operation is idempotent. Any other failure is logged and surfaced as unavailable.
   */
  async deleteUser(userId: string): Promise<void> {
    const { url, serviceKey } = this.config();
    let res: Response;
    try {
      res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
    } catch (err) {
      this.log.error(`Supabase Admin delete request failed for ${userId}: ${String(err)}`);
      throw new ServiceUnavailableException('We could not reach the account service. Please try again.');
    }
    // 200/204 = deleted, 404 = already gone. Anything else is a real failure.
    if (res.status === 200 || res.status === 204 || res.status === 404) return;
    const body = await res.text().catch(() => '');
    this.log.error(`Supabase Admin delete returned ${res.status} for ${userId}: ${body}`);
    throw new ServiceUnavailableException('We could not delete your account. Please try again.');
  }
}
