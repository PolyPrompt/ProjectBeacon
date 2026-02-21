import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  currentUserMock,
  getServiceSupabaseClientMock,
  fromMock,
  selectMock,
  eqMock,
  maybeSingleMock,
  updateMock,
  updateEqMock,
  updateSelectMock,
  updateSingleMock,
  insertMock,
  insertSelectMock,
  insertSingleMock,
} = vi.hoisted(() => ({
  currentUserMock: vi.fn(),
  getServiceSupabaseClientMock: vi.fn(),
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  updateMock: vi.fn(),
  updateEqMock: vi.fn(),
  updateSelectMock: vi.fn(),
  updateSingleMock: vi.fn(),
  insertMock: vi.fn(),
  insertSelectMock: vi.fn(),
  insertSingleMock: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: currentUserMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { upsertUserFromClerk } from "@/lib/users/upsert-user";

describe("upsertUserFromClerk", () => {
  beforeEach(() => {
    currentUserMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    fromMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
    maybeSingleMock.mockReset();
    updateMock.mockReset();
    updateEqMock.mockReset();
    updateSelectMock.mockReset();
    updateSingleMock.mockReset();
    insertMock.mockReset();
    insertSelectMock.mockReset();
    insertSingleMock.mockReset();

    currentUserMock.mockResolvedValue({
      id: "clerk-1",
      firstName: "Ada",
      lastName: "Lovelace",
      primaryEmailAddressId: "email-1",
      emailAddresses: [
        {
          id: "email-1",
          emailAddress: "ada@example.com",
        },
      ],
    });

    eqMock.mockReturnValue({
      maybeSingle: maybeSingleMock,
    });

    selectMock.mockReturnValue({
      eq: eqMock,
    });

    updateEqMock.mockReturnValue({
      select: updateSelectMock,
    });

    updateSelectMock.mockReturnValue({
      single: updateSingleMock,
    });

    updateMock.mockReturnValue({
      eq: updateEqMock,
    });

    insertSelectMock.mockReturnValue({
      single: insertSingleMock,
    });

    insertMock.mockReturnValue({
      select: insertSelectMock,
    });

    fromMock.mockReturnValue({
      select: selectMock,
      update: updateMock,
      insert: insertMock,
    });

    getServiceSupabaseClientMock.mockReturnValue({
      from: fromMock,
    });
  });

  it("throws when Clerk user is missing", async () => {
    currentUserMock.mockResolvedValue(null);

    await expect(upsertUserFromClerk("clerk-1")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("updates an existing user found by clerk id", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: "user-1" },
      error: null,
    });

    updateSingleMock.mockResolvedValue({
      data: { id: "user-1" },
      error: null,
    });

    const result = await upsertUserFromClerk("clerk-1");

    expect(eqMock).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledWith("clerk_user_id", "clerk-1");
    expect(updateMock).toHaveBeenCalledWith({
      clerk_user_id: "clerk-1",
      email: "ada@example.com",
      name: "Ada Lovelace",
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", "user-1");
    expect(insertMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      userId: "user-1",
      clerkUserId: "clerk-1",
      email: "ada@example.com",
      created: false,
    });
  });

  it("updates an existing user found by email when clerk id has changed", async () => {
    maybeSingleMock
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "user-2" }, error: null });

    updateSingleMock.mockResolvedValue({
      data: { id: "user-2" },
      error: null,
    });

    const result = await upsertUserFromClerk("clerk-1");

    expect(eqMock).toHaveBeenNthCalledWith(1, "clerk_user_id", "clerk-1");
    expect(eqMock).toHaveBeenNthCalledWith(2, "email", "ada@example.com");
    expect(updateEqMock).toHaveBeenCalledWith("id", "user-2");
    expect(insertMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      userId: "user-2",
      clerkUserId: "clerk-1",
      email: "ada@example.com",
      created: false,
    });
  });

  it("inserts a new user when no existing record matches", async () => {
    maybeSingleMock
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    insertSingleMock.mockResolvedValue({
      data: { id: "user-3" },
      error: null,
    });

    const result = await upsertUserFromClerk("clerk-1");

    expect(insertMock).toHaveBeenCalledWith({
      clerk_user_id: "clerk-1",
      email: "ada@example.com",
      name: "Ada Lovelace",
    });
    expect(updateMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      userId: "user-3",
      clerkUserId: "clerk-1",
      email: "ada@example.com",
      created: true,
    });
  });
});
