import { capabilities } from "@/server/access";
import { ok, route } from "@/server/http";

export const GET = route(async () => ok(await capabilities()));
