"use strict";

const { app, BrowserWindow, Menu, session } = require("electron");
const path = require("node:path");

const MEDTRACK_URL = process.env.MEDTRACK_APP_URL ||
    "https://www.medtrackmanagement.com/login/login.html";
const MEDTRACK_ORIGIN = new URL(MEDTRACK_URL).origin;
const OFFLINE_PAGE = path.join(__dirname, "offline.html");
const APP_ICON = path.join(
    __dirname,
    "..",
    "assets",
    "pdrrmo-logo-transparent.png"
);

app.setName("MedTrack");
app.setAppUserModelId("ph.gov.quezon.pdrrmo.medtrack");

if (!app.requestSingleInstanceLock()) {
    app.quit();
}

let mainWindow = null;

function isAllowedApplicationUrl(value) {
    try {
        return new URL(value).origin === MEDTRACK_ORIGIN;
    } catch (_error) {
        return false;
    }
}

function loadMedTrack() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.loadURL(MEDTRACK_URL).catch(function () {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadFile(OFFLINE_PAGE).catch(console.error);
        }
    });
}

function createWindow() {
    const persistentSession = session.fromPartition("persist:medtrack");
    persistentSession.setPermissionRequestHandler(function (_contents, _permission, callback) {
        callback(false);
    });

    mainWindow = new BrowserWindow({
        title: "MedTrack",
        width: 1440,
        height: 900,
        minWidth: 360,
        minHeight: 640,
        show: false,
        backgroundColor: "#f3f5f7",
        icon: APP_ICON,
        autoHideMenuBar: true,
        webPreferences: {
            partition: "persist:medtrack",
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            devTools: !app.isPackaged,
            safeDialogs: true,
            spellcheck: false
        }
    });

    mainWindow.webContents.setWindowOpenHandler(function () {
        return { action: "deny" };
    });

    mainWindow.webContents.on("will-navigate", function (event, targetUrl) {
        if (!isAllowedApplicationUrl(targetUrl)) event.preventDefault();
    });

    mainWindow.webContents.on(
        "did-fail-load",
        function (_event, errorCode, _description, _validatedUrl, isMainFrame) {
            if (!isMainFrame || errorCode === -3 || !mainWindow) return;
            mainWindow.loadFile(OFFLINE_PAGE).catch(console.error);
        }
    );

    mainWindow.once("ready-to-show", function () {
        mainWindow.show();
    });
    mainWindow.on("closed", function () {
        mainWindow = null;
    });

    Menu.setApplicationMenu(null);
    loadMedTrack();
}

app.on("second-instance", function () {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
});

app.whenReady().then(function () {
    createWindow();
    app.on("activate", function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", function () {
    if (process.platform !== "darwin") app.quit();
});
