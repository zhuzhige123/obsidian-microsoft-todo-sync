export class TFile {
  path = "";
  extension = "md";
}

export class Plugin {
  app = {};
}

export class Notice {
  constructor(_message: string) {
    void _message;
  }
}

export function requestUrl(): Promise<{ status: number; text: string }> {
  return Promise.resolve({ status: 200, text: "{}" });
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function setIcon(): void {
  // noop
}

export const Platform = { isDesktopApp: true };
export const editorLivePreviewField = {};
