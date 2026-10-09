export interface NotificationMessage { title: string; message: string; click?: string; tags?: string[] }
export interface BrowserPublish { url: string; payload: NotificationMessage & { topic: string } }
export interface BrowserNotification extends BrowserPublish { id: string; revision: number; lease: string }
export interface NotificationClaim { enabled: boolean; job: BrowserNotification | null }
export interface NotificationTest { ok: true; message: string; publish?: BrowserPublish }
