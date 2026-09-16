export {};

declare global {
  interface Window {
    desktop?: {
      getVersion(): Promise<string>;
      openExternal(url: string): Promise<void>;
    };
  }
}
