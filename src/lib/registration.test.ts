import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isRequestableRole,
  normalizeEmail,
  registrationStatusLabel,
  requestedRoleLabel,
} from "@/lib/registration";

describe("registration helpers", () => {
  it("normalizes email and validates requestable roles", () => {
    assert.equal(normalizeEmail("  Foo@Example.COM "), "foo@example.com");
    assert.equal(isRequestableRole("USER"), true);
    assert.equal(isRequestableRole("TEACHER"), true);
    assert.equal(isRequestableRole("ADMIN"), false);
  });

  it("labels status and role", () => {
    assert.equal(registrationStatusLabel("PENDING"), "待審核");
    assert.equal(requestedRoleLabel("TEACHER"), "老師");
    assert.equal(requestedRoleLabel("USER"), "一般使用者");
  });
});
