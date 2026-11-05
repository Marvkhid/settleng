import { vi } from "vitest";

export interface ApiMock {
  me: ReturnType<typeof vi.fn>;
  bootstrap: ReturnType<typeof vi.fn>;
  loginNotice: ReturnType<typeof vi.fn>;
  updateProfile: ReturnType<typeof vi.fn>;
  deleteAccount: ReturnType<typeof vi.fn>;
}

export const apiMock: ApiMock = {
  me: vi.fn(),
  bootstrap: vi.fn(),
  loginNotice: vi.fn().mockResolvedValue({ sent: false, reason: "not_configured" }),
  updateProfile: vi.fn(),
  deleteAccount: vi.fn(),
};

export function resetMockApi() {
  apiMock.me.mockClear();
  apiMock.bootstrap.mockClear();
  apiMock.loginNotice.mockClear();
  apiMock.updateProfile.mockClear();
  apiMock.deleteAccount.mockClear();
}
