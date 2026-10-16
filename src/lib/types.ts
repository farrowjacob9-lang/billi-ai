export type View = "workspace" | "routines" | "history";
export type Routine = { id: string; name: string; createdAt: string };
export type Message = { id: number; role: "user" | "assistant"; text: string };
export type Modal = "routine" | "settings" | null;
export type SettingsInfo = { intro: string; rows: [label: string, value: string][]; footnote: string; routineStorage: string };
