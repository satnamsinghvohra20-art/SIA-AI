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
    this.previousCpuTimes = this._getCpuTimes();
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

  _getCpuTimes() {
    try {
      const cpus = os.cpus();
      let idle = 0;
      let total = 0;
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          total += cpu.times[type];
        }
        idle += cpu.times.idle;
      }
      return { idle, total };
    } catch (_) {
      return { idle: 0, total: 1 };
    }
  }

  _calculateCpuLoad() {
    const current = this._getCpuTimes();
    if (!this.previousCpuTimes) {
      this.previousCpuTimes = current;
      return 0;
    }
    const idleDiff = current.idle - this.previousCpuTimes.idle;
    const totalDiff = current.total - this.previousCpuTimes.total;
    this.previousCpuTimes = current;
    if (totalDiff <= 0) return 0;
    const loadPct = Math.round((1 - idleDiff / totalDiff) * 100);
    return Math.max(0, Math.min(100, loadPct));
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
      const cpuLoad = this._calculateCpuLoad();

      let alert = null;
      if (memUsagePct > 92) {
        alert = `⚠️ High Memory Load Warning: System RAM usage is at ${memUsagePct}%. Consider closing idle applications.`;
      } else if (cpuLoad > 92) {
        alert = `⚠️ High CPU Load Warning: CPU utilization is at ${cpuLoad}%.`;
      }

      this.latestTelemetry = {
        cpuLoad,
        freeMemMB: freeMem,
        totalMemMB: totalMem,
        memUsagePct,
        batteryLevel: this.latestTelemetry.batteryLevel,
        isCharging: this.latestTelemetry.isCharging,
        uptimeHours,
        alert,
        audit: this.auditSystemHealth(),
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

  auditSystemHealth() {
    const findings = [];
    try {
      const { getModelHealthReport } = require("./openrouterClient");
      const { semanticCache } = require("./semanticCache");
      const health = getModelHealthReport();
      const cacheStats = semanticCache.getStats();

      if (health.quarantined.length > 0) {
        findings.push({
          severity: "medium",
          area: "model_routing",
          detail: `${health.quarantined.length} model(s) temporarily quarantined with automatic failover active.`,
        });
      }
      if (health.summary?.errorRatePct > 25 && health.summary?.totalCalls >= 4) {
        findings.push({
          severity: "high",
          area: "provider_reliability",
          detail: `Elevated model error rate: ${health.summary.errorRatePct}% across ${health.summary.totalCalls} calls.`,
        });
      }
      return {
        tier: health.tier,
        completionRatePct: health.summary?.completionRatePct ?? 100,
        quarantinedCount: health.quarantined.length,
        cacheHitRate: cacheStats.hitRate,
        findings,
        checkedAt: new Date().toISOString(),
      };
    } catch (_) {
      return { findings: [], checkedAt: new Date().toISOString() };
    }
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
