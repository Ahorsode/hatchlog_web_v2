import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const fetchMock = vi.fn()

vi.mock('@/lib/supabase/session', () => ({
  getSupabaseAccessToken: vi.fn().mockResolvedValue('test-token'),
}))

describe('Nest CRUD API contract (web helpers)', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    process.env.HATCHLOG_API_URL = 'http://localhost:3001'
    process.env.HATCHLOG_ADMIN_API_KEY = 'test-admin-key'
  })

  it('calls growth standards and monthly summary Nest paths', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
    })

    const {
      getGrowthStandardsApi,
      getMonthlyProductionSummaryApi,
    } = await import('@/lib/hatchlog-api')

    await getGrowthStandardsApi('POULTRY_BROILER')
    await getMonthlyProductionSummaryApi('farm_1')

    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls.some((u) => u.includes('/api/v1/growth-standards'))).toBe(true)
    expect(
      urls.some((u) => u.includes('/api/v1/dashboard/monthly-summary')),
    ).toBe(true)
  })

  it('calls supplier profile and balance Nest paths', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { id: 'sup_1' } }),
    })

    const { updateSupplierApi, updateSupplierBalanceApi } = await import(
      '@/lib/hatchlog-api'
    )

    await updateSupplierApi('sup_1', { farm_id: 'farm_1', name: 'Feed Co' })
    await updateSupplierBalanceApi('sup_1', { farm_id: 'farm_1', amount: 10 })

    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls.some((u) => u.endsWith('/api/v1/suppliers/sup_1'))).toBe(true)
    expect(
      urls.some((u) => u.endsWith('/api/v1/suppliers/sup_1/balance')),
    ).toBe(true)
  })

  it('calls egg category update/delete Nest paths', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { id: 'cat_1' } }),
    })

    const { updateEggCategoryApi, deleteEggCategoryApi } = await import(
      '@/lib/hatchlog-api'
    )

    await updateEggCategoryApi('cat_1', {
      farm_id: 'farm_1',
      sellingPrice: 40,
    })
    await deleteEggCategoryApi('cat_1', 'farm_1')

    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls.some((u) => u.includes('/api/v1/egg-categories/cat_1'))).toBe(
      true,
    )
  })

  it('calls admin device-by-hardware Nest path', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          farmName: 'Green Farm',
          subscriptionTier: 'PRO',
          status: 'ACTIVE',
          licenseExpiresAt: null,
          lastSync: null,
        },
      }),
    })

    const { adminGetDeviceByHardwareApi } = await import('@/lib/hatchlog-api')
    await adminGetDeviceByHardwareApi('abc 123')

    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(
      urls.some((u) =>
        u.includes('/api/v1/admin/licenses/by-hardware/abc%20123'),
      ),
    ).toBe(true)
  })
})
