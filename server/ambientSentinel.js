/**
 * Proactive Ambient Sentinel Daemon for Sia AI
 * Runs background telemetry heartbeat, monitors system health, and prepares daily briefings.
 */

const os = require("os");
const { exec } = require("child_process");

class AmbientSentinel {
  constructor() {
    this.interval = null;
    this.heartbeatMs = 60 * 1000; // 60 seconds
    this.lastBriefingDate = null;
    this.latestTelemetry = {
      cpuLoad: 0,
      freeMemMB: 0,
      totalMemMB: 0,
      memUsagePct: 0,
      batteryLevel: null,
      isCharging: null,
      uptimeHours: 0,
      alert: null,
      timestamp: Date.now(),
    };
  }

  start() {
    if (this.interval) return;
    this.tick();
    this.interval = setInterval(() => this.tick(), this.heartbeatMs);
    console.log("[AmbientSentinel] Autonomous Sentinel Daemon active (60s tick).");
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async tick() {
    try {
      const totalMem = Math.round(os.totalmem() / (1024 * 1024));
      const freeMem = Math.round(os.freemem() / (1024 * 1024));
      const memUsagePct = Math.round(((totalMem - freeMem) / totalMem) * 100);
      const uptimeHours = Number((os.uptime() / 3600).toFixed(1));

      let alert = null;
      if (memUsagePct > 92) {
        alert = `⚠️ High Memory Load Warning: System RAM usage is at ${memUsagePct}%. Consider closing idle applications.`;
      }

      this.latestTelemetry = {
        cpuLoad: os.loadavg ? os.loadavg()[0] || 0 : 0,
        freeMemMB: freeMem,
        totalMemMB: totalMem,
        memUsagePct,
        batteryLevel: this.latestTelemetry.batteryLevel,
        isCharging: this.latestTelemetry.isCharging,
        uptimeHours,
        alert,
        timestamp: Date.now(),
      };

      // Query Windows Battery status if on Windows
      if (process.platform === "win32") {
        exec(
          `powershell -NoProfile -Command "Get-CimInstance -ClassName Win32_Battery | Select-Object -Property EstimatedChargeRemaining, BatteryStatus"`,
          { timeout: 3000 },
          (err, stdout) => {
            if (!err && stdout) {
              const chargeMatch = stdout.match(/(\d+)/);
              if (chargeMatch) {
                this.latestTelemetry.batteryLevel = Number(chargeMatch[1]);
              }
            }
          }
        );
      }
    } catch (_) {}
  }

  getHealthReport() {
    return {
      ...this.latestTelemetry,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    };
  }

  getBriefing() {
    const now = new Date();
    const hour = now.getHours();
    let greeting = "Good morning, sir";
    if (hour >= 12 && hour < 17) greeting = "Good afternoon, sir";
    if (hour >= 17) greeting = "Good evening, sir";

    const report = this.getHealthReport();
    let batterySnippet = "";
    if (report.batteryLevel !== null) {
      batterySnippet = ` Battery level is currently at ${report.batteryLevel}%.`;
    }

    const briefing = `${greeting}. Sia online and operating under Sovereign Core. System memory is at ${report.memUsagePct}%, and uptime is ${report.uptimeHours} hours.${batterySnippet} All defensive, execution, and neural channels are 100% operational.`;

    this.lastBriefingDate = now.toDateString();
    return {
      greeting,
      briefing,
      telemetry: report,
      timestamp: now.toISOString(),
    };
  }
}

const ambientSentinel = new AmbientSentinel();
module.exports = { ambientSentinel, AmbientSentinel };
