import test from "node:test";
import assert from "node:assert/strict";
import { ipBucket } from "../src/server/ip.ts";

test("rate limits count IPv6 clients by /64 and IPv4 clients by address", () => {
  assert.equal(ipBucket("203.0.113.9"), "203.0.113.9");
  assert.equal(ipBucket("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), "2001:db8:1:2::/64");
  assert.equal(ipBucket("2001:0DB8:0001:0002::1"), "2001:db8:1:2::/64");
  assert.equal(ipBucket("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(ipBucket("::1"), "0:0:0:0::/64");
  assert.equal(ipBucket("unknown"), "unknown");
});
