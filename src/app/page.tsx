import { connection } from "next/server";
import { App } from "@/components/App";
import { capabilities } from "@/server/access";

export default async function Page() {
  // Mode and session come from runtime environment and cookies, so never prerender this page.
  await connection();
  return <App caps={await capabilities()} />;
}
