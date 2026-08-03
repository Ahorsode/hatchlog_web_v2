import { describe, expect, it } from "vitest";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordPolicyError,
} from "../password-policy";

describe("password policy", () => {
  it("rejects common banned passwords", () => {
    expect(passwordPolicyError("123456")).toMatch(/too common/i);
    expect(passwordPolicyError(" Password ")).toMatch(/too common/i);
  });

  it("requires at least 4 characters", () => {
    expect(passwordPolicyError("abc")).toBe(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    );
  });

  it("accepts a non-banned password within policy bounds", () => {
    expect(passwordPolicyError("short-pass")).toBeNull();
    expect(passwordPolicyError("correct-horse-42")).toBeNull();
  });

  it("rejects overlong passwords", () => {
    expect(passwordPolicyError("a".repeat(MAX_PASSWORD_LENGTH + 1))).toBe(
      `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer`,
    );
  });
});
