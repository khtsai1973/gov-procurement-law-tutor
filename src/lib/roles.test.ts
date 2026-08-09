import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canAccessTeacher,
  isAssignableRole,
  resolveRoleFromEmail,
  roleLabel,
  shouldForceAllowlistRoleOnLogin,
  validateUserRoleChange,
} from "./roles";

describe("roles", () => {
  it("resolves builtin teacher email", () => {
    assert.equal(resolveRoleFromEmail("sports20140906@gmail.com"), "TEACHER");
    assert.equal(resolveRoleFromEmail("Sports20140906@Gmail.com"), "TEACHER");
    assert.equal(resolveRoleFromEmail("random-student@example.com"), "USER");
  });

  it("labels and teacher access", () => {
    assert.equal(canAccessTeacher("TEACHER"), true);
    assert.equal(canAccessTeacher("ADMIN"), true);
    assert.equal(canAccessTeacher("USER"), false);
    assert.equal(roleLabel("TEACHER"), "老師");
    assert.equal(roleLabel("ADMIN"), "管理者");
    assert.equal(roleLabel("USER"), "學員");
  });

  it("assignable roles", () => {
    assert.equal(isAssignableRole("USER"), true);
    assert.equal(isAssignableRole("TEACHER"), true);
    assert.equal(isAssignableRole("ADMIN"), true);
    assert.equal(isAssignableRole("GUEST"), false);
  });

  it("only forces ADMIN allowlist role on login", () => {
    assert.equal(shouldForceAllowlistRoleOnLogin("ADMIN"), true);
    assert.equal(shouldForceAllowlistRoleOnLogin("TEACHER"), false);
    assert.equal(shouldForceAllowlistRoleOnLogin("USER"), false);
  });

  it("validates role changes", () => {
    assert.deepEqual(
      validateUserRoleChange({
        actorUserId: "a1",
        targetUserId: "u2",
        currentRole: "USER",
        nextRole: "TEACHER",
        adminCount: 1,
      }),
      { ok: true },
    );

    assert.equal(
      validateUserRoleChange({
        actorUserId: "a1",
        targetUserId: "a1",
        currentRole: "ADMIN",
        nextRole: "TEACHER",
        adminCount: 2,
      }).ok,
      false,
    );

    assert.equal(
      validateUserRoleChange({
        actorUserId: "a1",
        targetUserId: "a2",
        currentRole: "ADMIN",
        nextRole: "USER",
        adminCount: 1,
      }).ok,
      false,
    );

    assert.deepEqual(
      validateUserRoleChange({
        actorUserId: "a1",
        targetUserId: "a2",
        currentRole: "ADMIN",
        nextRole: "USER",
        adminCount: 2,
      }),
      { ok: true },
    );

    assert.equal(
      validateUserRoleChange({
        actorUserId: "a1",
        targetUserId: "u2",
        currentRole: "USER",
        nextRole: "USER",
        adminCount: 1,
      }).ok,
      false,
    );
  });
});
