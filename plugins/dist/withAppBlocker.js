"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("@expo/config-plugins");
const PERMISSIONS = [
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
    "android.permission.PACKAGE_USAGE_STATS",
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.RECEIVE_BOOT_COMPLETED",
];
const withAppBlocker = (config) => (0, config_plugins_1.withAndroidManifest)(config, (cfg) => {
    var _a;
    const manifest = cfg.modResults.manifest;
    // ── Permissions ──────────────────────────────────────────────────────────
    if (!manifest["uses-permission"])
        manifest["uses-permission"] = [];
    for (const perm of PERMISSIONS) {
        const already = manifest["uses-permission"].some((p) => p.$["android:name"] === perm);
        if (!already) {
            manifest["uses-permission"].push({ $: { "android:name": perm } });
        }
    }
    const app = (_a = manifest.application) === null || _a === void 0 ? void 0 : _a[0];
    if (!app)
        return cfg;
    // ── Foreground service ───────────────────────────────────────────────────
    if (!app.service)
        app.service = [];
    const svcName = "expo.modules.appblocker.AppBlockerService";
    if (!app.service.some((s) => s.$["android:name"] === svcName)) {
        app.service.push({
            $: {
                "android:name": svcName,
                "android:foregroundServiceType": "dataSync",
                "android:exported": "false",
                "android:enabled": "true",
            },
        });
    }
    return cfg;
});
exports.default = withAppBlocker;
