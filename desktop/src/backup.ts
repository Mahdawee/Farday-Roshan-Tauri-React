import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { inDesktop } from './store';

/** Returns false when the user cancels; never simulates a backup in the browser. */
export async function createBackup(): Promise<boolean> {
  if (!inDesktop) throw new Error('پشتیبان‌گیری فقط در نسخهٔ دسکتاپ قابل استفاده است.');
  const date = new Date();
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}`;
  const path = await save({ title: 'محل ذخیرهٔ پشتیبان', defaultPath: `farday-backup-${stamp}.sqlite3`, filters: [{ name: 'SQLite', extensions: ['sqlite3'] }] });
  if (!path) return false;
  await invoke('create_backup', { path });
  return true;
}

export interface BackupInfo { schema_version: number; customers: number; sales: number; receipts: number; employees: number; expenses: number; salaries: number }
export interface RestoreResult { safety_backup: string; customers: number; sales: number; receipts: number; employees: number; expenses: number; salaries: number }

export async function chooseBackup(): Promise<{ path: string; info: BackupInfo } | null> {
  if (!inDesktop) throw new Error('بازگردانی فقط در نسخهٔ دسکتاپ قابل استفاده است.');
  const path = await open({ title: 'انتخاب فایل پشتیبان', multiple: false, directory: false, filters: [{ name: 'SQLite', extensions: ['sqlite3'] }] });
  if (!path) return null;
  const info = await invoke<BackupInfo>('inspect_backup', { path });
  return { path, info };
}
export async function restoreBackup(path: string): Promise<RestoreResult> {
  if (!inDesktop) throw new Error('بازگردانی فقط در نسخهٔ دسکتاپ قابل استفاده است.');
  return invoke<RestoreResult>('restore_backup', { path });
}
