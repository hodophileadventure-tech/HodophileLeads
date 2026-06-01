import fs from 'fs';
import path from 'path';
import { screenCaptureModel } from '../models/ScreenCapture';

const cleanupOnce = async () => {
  try {
    const expired = await screenCaptureModel.listExpired();
    for (const item of expired) {
      const fileName = item.file_name || item.fileName || (item.url ? path.basename(item.url) : null);
      if (fileName) {
        const filePath = path.join(__dirname, '..', '..', 'uploads', 'screen-captures', fileName);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (error) {
          console.warn('Failed to delete expired screen capture file', (error as any)?.message || error);
        }
      }
      await screenCaptureModel.delete(String(item.id));
    }
  } catch (error) {
    console.warn('Screen capture cleanup failed', (error as any)?.message || error);
  }
};

export function startScreenCaptureCleanup() {
  void cleanupOnce();
  return setInterval(() => {
    void cleanupOnce();
  }, 30 * 60 * 1000);
}

export default { startScreenCaptureCleanup };
