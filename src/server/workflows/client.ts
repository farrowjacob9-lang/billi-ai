import { Inngest } from "inngest";
export const workflowsConfigured = () =>
  !!process.env.INNGEST_EVENT_KEY && !!process.env.INNGEST_SIGNING_KEY;
export const workflows = new Inngest({
  id: "naxium-workspace",
  isDev: process.env.NODE_ENV !== "production",
});
