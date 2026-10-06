import configData from "../desktop.config.json";

export interface DesktopConfig {
  app: {
    name: string;
    slug: string;
    version: string;
    description: string;
    author: {
      name: string;
      email: string;
      url?: string;
    };
    bundleId: string;
    category?: string;
  };
  window: {
    title: string;
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    backgroundColor: string;
    titleBarStyle: "hidden" | "hiddenInset" | "default" | "customButtonsOnHover";
    frame: boolean;
    resizable: boolean;
    maximizable: boolean;
    minimizable: boolean;
    center: boolean;
  };
  database: {
    filename: string;
    autoBackup: boolean;
    backupIntervalMinutes: number;
  };
  build: {
    icon: string;
    copyright: string;
    windows?: {
      productName?: string;
      executableName?: string;
      setupExe?: string;
    };
    mac?: {
      category?: string;
    };
    linux?: {
      maintainer?: string;
      section?: string;
    };
  };
}

export const desktopConfig = configData as unknown as DesktopConfig;
export default desktopConfig;
