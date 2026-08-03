import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  invitationFindFirst: vi.fn(),
  farmMemberFindUnique: vi.fn(),
  farmMemberCreate: vi.fn(),
  userUpdate: vi.fn(),
  invitationUpdate: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  default: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
    invitation: {
      findFirst: mocks.invitationFindFirst,
      update: mocks.invitationUpdate,
    },
    farmMember: {
      findUnique: mocks.farmMemberFindUnique,
      create: mocks.farmMemberCreate,
    },
  },
}))

describe('Google sign-in for email-invited workers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts a pending email invitation and creates farm membership', async () => {
    const { acceptPendingInvitationForUser } = await import('@/lib/auth-utils')

    mocks.userFindUnique.mockResolvedValue({
      email: 'worker@example.com',
      phoneNumber: null,
    })
    mocks.invitationFindFirst.mockResolvedValue({
      id: 'invite-1',
      farmId: 'farm-1',
      role: 'WORKER',
      email: 'worker@example.com',
      status: 'PENDING',
    })
    mocks.farmMemberFindUnique.mockResolvedValue(null)
    mocks.farmMemberCreate.mockResolvedValue({
      farmId: 'farm-1',
      userId: 'user-1',
      role: 'WORKER',
    })
    mocks.userUpdate.mockResolvedValue({})
    mocks.invitationUpdate.mockResolvedValue({})

    const farmId = await acceptPendingInvitationForUser('user-1')

    expect(farmId).toBe('farm-1')
    expect(mocks.invitationFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ email: 'worker@example.com' }],
        status: 'PENDING',
      },
    })
    expect(mocks.farmMemberCreate).toHaveBeenCalledWith({
      data: {
        farmId: 'farm-1',
        userId: 'user-1',
        role: 'WORKER',
      },
    })
    expect(mocks.invitationUpdate).toHaveBeenCalledWith({
      where: { id: 'invite-1' },
      data: { status: 'ACCEPTED' },
    })
  })

  it('matches invitations using the invited user email stored in lowercase', async () => {
    const { acceptPendingInvitationForUser } = await import('@/lib/auth-utils')

    mocks.userFindUnique.mockResolvedValue({
      email: 'Worker@Example.com',
      phoneNumber: null,
    })
    mocks.invitationFindFirst.mockResolvedValue({
      id: 'invite-1',
      farmId: 'farm-1',
      role: 'WORKER',
      email: 'worker@example.com',
      status: 'PENDING',
    })
    mocks.farmMemberFindUnique.mockResolvedValue({
      farmId: 'farm-1',
      userId: 'user-1',
      role: 'WORKER',
    })
    mocks.userUpdate.mockResolvedValue({})
    mocks.invitationUpdate.mockResolvedValue({})

    await acceptPendingInvitationForUser('user-1')

    expect(mocks.invitationFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ email: 'worker@example.com' }],
        status: 'PENDING',
      },
    })
    expect(mocks.farmMemberCreate).not.toHaveBeenCalled()
    expect(mocks.invitationUpdate).toHaveBeenCalled()
  })

  it('clears mustChangePassword when completing Google sign-in', async () => {
    const { completeGoogleSignIn } = await import('@/lib/auth-utils')

    mocks.userFindUnique.mockResolvedValue({
      email: 'worker@example.com',
      phoneNumber: null,
    })
    mocks.invitationFindFirst.mockResolvedValue(null)
    mocks.userUpdate.mockResolvedValue({})

    await completeGoogleSignIn('user-1')

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { mustChangePassword: false },
    })
  })
})
