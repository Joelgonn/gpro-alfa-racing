import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.gproalfaracing',
  appName: 'GPRO Alfa Racing Brasil',
  webDir: 'public',
  server: {
    url: 'https://gpro-alfa-racing.vercel.app',
    cleartext: false,
  },
};

export default config;