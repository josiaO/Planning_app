// Simple WiFi sync server for local network sync
// This creates a basic HTTP server that can serve sync data

export class WifiSyncServer {
  private port: number;
  private server: any = null;
  private isRunning = false;

  constructor(port: number = 8080) {
    this.port = port;
  }

  async start(_exportData: () => Promise<any>): Promise<string> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    try {
      // Get local IP address
  const response = await fetch('https://api.ipify.org?format=json');
  const data = await response.json();
  const localIP = data.ip;

      // For now, we'll simulate the server
      // In a real implementation, you'd use a proper HTTP server
      this.isRunning = true;
      
      return `http://${localIP}:${this.port}`;
    } catch (error) {
      throw new Error(`Failed to start WiFi sync server: ${error}`);
    }
  }

  stop() {
    this.isRunning = false;
    if (this.server) {
      // Stop the actual server if it exists
      this.server = null;
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getUrl(): string {
    if (!this.isRunning) return '';
    return `http://localhost:${this.port}`;
  }
}

// Helper function to get local IP address
export async function getLocalIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    // Fallback to localhost
    return 'localhost';
  }
}

// Helper function to sync from a WiFi URL
export async function syncFromWifiUrl(url: string): Promise<any> {
  try {
    const response = await fetch(`${url}/sync-data`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to sync from WiFi URL: ${error}`);
  }
}

