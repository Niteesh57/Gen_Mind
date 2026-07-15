export interface DeviceIdentity {
  deviceId: string;
  deviceName: string;
}

export function getDeviceIdentity(): DeviceIdentity {
  if (typeof window === 'undefined') {
    return { deviceId: 'DEV_DEFAULT_PC', deviceName: 'Workstation-PC' };
  }

  let deviceId = localStorage.getItem('genblaze_device_id');
  if (!deviceId) {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const platform = (navigator.platform || 'PC').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
    deviceId = `DEV_${platform}_${randomHex}`;
    localStorage.setItem('genblaze_device_id', deviceId);
  }

  let deviceName = localStorage.getItem('genblaze_device_name');
  if (!deviceName) {
    const ua = navigator.userAgent;
    let browser = 'Chrome';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edge')) browser = 'Edge';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';

    deviceName = `${browser} on ${navigator.platform || 'Windows PC'}`;
    localStorage.setItem('genblaze_device_name', deviceName);
  }

  return { deviceId, deviceName };
}
