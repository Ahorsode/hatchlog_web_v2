import "@testing-library/jest-dom";
import { vi } from "vitest";

// Keep tests isolated from the real database by mocking the Prisma singleton.
vi.mock("@/lib/db", () => ({
  default: {
    flock: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    record: { findMany: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    $disconnect: vi.fn(),
  },
}));
