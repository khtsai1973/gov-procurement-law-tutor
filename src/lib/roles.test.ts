import assert from "node:assert/strict";

import { canAccessTeacher, resolveRoleFromEmail, roleLabel } from "./roles";

assert.equal(resolveRoleFromEmail("sports20140906@gmail.com"), "TEACHER");
assert.equal(resolveRoleFromEmail("Sports20140906@Gmail.com"), "TEACHER");
assert.equal(canAccessTeacher("TEACHER"), true);
assert.equal(roleLabel("TEACHER"), "老師");
assert.equal(resolveRoleFromEmail("random-student@example.com"), "USER");

console.log("roles: ok");
