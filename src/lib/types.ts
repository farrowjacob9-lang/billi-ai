export type View = "workspace" | "routines" | "history";
export type Routine = { id: string; name: string; createdAt: string };
// "run" messages narrate report preparation (and name the file); they are never sent to the model.
export type Message = { id: number; role: "user" | "assistant"; text: string; kind?: "run" };
export type Modal = "routine" | "settings" | null;
// What went wrong decides the error card's title: the file, the session, or our side.
export type UiError = { kind: "file" | "session" | "server"; message: string };
export type SettingsInfo = { intro: string; rows: [label: string, value: string][]; footnote: string; routineStorage: string };
