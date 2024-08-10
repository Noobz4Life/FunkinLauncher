// We do not define anything since this file is evaluated when IPCs are defined.
// Maybe evaluation isn't the best approach, though.

// construct buttons
function immb(modName, engineID) {
    return '<button onclick ="removeMod(\'' + modName + '\', \'' + engineID + '\')">Remove</button>';
}

function passToSettings() {
    sw.webContents.executeJavaScript('passData("' + dbGetAllEngines() + '");');

    // Define top of the table
    var arrayOfStuff = ['<table><tr><th>Mod Name</th><th>Engine</th><th>Actions</th></tr>'];
    var allEngines = dbGetAllEngines();
    allEngines.forEach((element) => {
        var enginepather = dbReadValue(element);
        var atLeastOneMod = false;
        try {
            fs.readdirSync(path.join(enginepather, 'mods')).forEach((element2) => {
                if (fs.lstatSync(path.join(enginepather, 'mods', element2)).isDirectory()) {
                    arrayOfStuff.push("<tr><td>" + element2 + "</td><td>" + formalName[parseInt(element.replace('engine', ''))] + '</td><td>' + immb(element2, element) + '</td></tr>');
                }
            });
        } catch (e) {
            // Do not do anything as this engine has no mods
        }
    });

    arrayOfStuff.push('</table>');
    sw.webContents.executeJavaScript("showMods('" + btoa(arrayOfStuff.join('')) + "')");
    
    return true;
}
ipcMain.on('log', (event, message) => {
    logStream.write('(RENDERER PROCESS) ' + message + '\n');
    process.stdout.write('(RENDERER PROCESS) ' + message + '\n');
});

ipcMain.on('reload-launcher', (event) => {
    if (win) {
        win.show();
        win.webContents.executeJavaScript('window.location.reload();');
    }
});

ipcMain.on('import-engine', (event, engineID) => {
    // prompt user to select a folder
    const webContents = event.sender;
    const eventer = BrowserWindow.fromWebContents(webContents);
    console.log('importing engine...');
    dialog.showOpenDialog(win, { properties: ['openDirectory'] }).then((result) => {
        var src = result.filePaths[0];
        if (!src || src == '' || src == null || src == undefined) {
            return;
        }
        console.log('importing engine from ' + src);
        dbWriteValue('engine' + engineID, src);
        eventer.webContents.executeJavaScript('window.alert(\'Imported engine successfully!\');onGameClose();');
    });
});

ipcMain.on('download-engine', (event, engineID) => {
    win.show();
    downloadEngine(engineID);
});

ipcMain.on('open-engine-folder', (event) => {
    shell.openPath(path.join(appDataPath, 'engines'));
});

ipcMain.on('open-logs-folder', (event) => {
    shell.openPath(path.join(appDataPath, 'logs'));
});

ipcMain.on('remove-engine', (event, engineID, removeFiles) => {
    if (removeFiles) {
        fs.rmSync(dbReadValue('engine' + engineID), { recursive: true });
    }
    dbDeleteValue('engine' + engineID);
});

// Separate platforms use their own starting command.
function getStartCmd(exeName, cwd) {
    var exePath = path.join(cwd, exeName)
    var execCmd = ''
    if(exePath == null || process.platform == 'win32') return execCmd;

    // Since execNames don't have .exe in them, we check if an .exe exists or not.
    // The first part is for future-proofing
    var isExe = exePath.endsWith('.exe') || (!fs.existsSync(exePath) && fs.existsSync(exePath + '.exe')) 

    switch(process.platform) {
        case 'freebsd': // As far as I know, FreeBSD also uses WINE
        case 'linux':
            if (isExe) {
                // WINE lets you use Windows programs on Linux.
                execCmd = 'wine start '
            }
            break
        case 'darwin': // Mac
            if(isExe) {
                // I'm unsure of what the standard is on Mac, so we'll just use whatever the default application is for executables on Mac (most likely a variant of WINE)
                execCmd = 'open '
            }
            break
    }
    return execCmd
}

// This function handles logging, how the game is started, etc.
function execGame(exePath, execArgs, engineID) {
    var cwd = path.dirname(exePath)
    var exeName = path.basename(exePath)
    var execCmd = exeName
    var execOptions = {cwd:cwd}

    if(execArgs != null) {
        execCmd = execCmd + ' ' + execArgs
    }

    // Use the WINE prefix on non-Windows platforms
    if (process.platform != 'win32') {
        console.log(`Using WINE prefix: ${defaultWinePrefix}`)
        execOptions.env = { ...process.env, WINEPREFIX: defaultWinePrefix } 

        // TODO: Setup WINE prefix for the user (WINE doesn't come with Discord RPC or Windows fonts)
        if (!fs.existsSync(defaultWinePrefix)) {
            fs.mkdirSync(defaultWinePrefix, { recursive: true });
        }
    }
    return exec(getStartCmd(exeName, cwd) + execCmd, execOptions, (err, stdout, stderr) => {
        if (err) {
            console.error(err);
            win.show();
            win.webContents.executeJavaScript('onUnexpectedGameClose();');
            return;
        }
        console.log(stdout);
        win.show();
        win.webContents.executeJavaScript('onGameClose();');
    });
}

ipcMain.on('load-game', (event, engineID) => {
    win.webContents.executeJavaScript('onGameLoad();');
    win.hide();
    var gamePath = dbReadValue('engine' + engineID);
    console.log('loading game from ' + gamePath);
    if (!fs.existsSync(gamePath)) {
        win.show();
        win.webContents.executeJavaScript('promptDownload();');
        return;
    }

    var cwd = dbReadValue('engine' + engineID)
    execGame(path.join(cwd,execName[engineID]), null, cwd, engineID);
});

ipcMain.on('open-settings', (event) => {
    sw = new BrowserWindow({
        parent: win,
        modal: true,
        width: 800,
        height: 600,
        resizable: false,
        fullscreenable: false,
        minimizable: false,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, 'RendererIPC.js')
        }
    });
    
    sw.loadFile(path.join(__dirname, '../', 'static', 'settings.html'));
    sw.webContents.on('did-finish-load', () => {
        passToSettings();
    });
});

ipcMain.on('reload-settings', (event) => {
    if (sw) {
        passToSettings();
    }
});

ipcMain.on('load-mm', (event, engineID) => {
    win.webContents.executeJavaScript('onGameLoad();');
    win.hide();
    var gamePath = dbReadValue('engine1');
    console.log('loading game from ' + gamePath);
    if (!fs.existsSync(gamePath)) {
        win.show();
        win.webContents.executeJavaScript('promptDownload();');
        return;
    }

    var cwd = dbReadValue('engine' + engineID)
    execGame(path.join(cwd,execName[engineID]),'-mm', cwd, engineID)
});

ipcMain.on('security-alert', (event, setHost, host) => {
    if (!setHost) {
        dialog.showMessageBox({
            title: 'Security Alert',
            message: 'Warning! Third party servers are not controlled by us and may be harmful. We do not take responsibility for any damage caused by third party servers and their content. Please be sure to trust the author of this build host before proceeding.',
            buttons: ['Ok']
        });
    }
    else {
        dialog.showMessageBox({
            title: (host == 'ffm-backend.web.app' ? 'Warning' : 'Security Warning'),
            message: (host == 'ffm-backend.web.app' ? 'Are you sure you want to make these changes?' : 'Warning! Third party servers are not controlled by us and may be harmful. We do not take responsibility for any damage caused by third party servers and their content. Please be sure to trust the author of this build host before proceeding. Are you sure you want to trust ' + host + ' and use it as your build host?'),
            buttons: ['Yes','No'],
            defaultId: 1
        }).then((result) => {
            if (result.response == 0) {
                dbWriteValue('engineSrc', host);
                dialog.showMessageBox({
                    message: 'The app will now restart to apply the changes.',
                }).then(() => {
                    app.relaunch();
                    app.quit();
                });
            }
        });
    }
});

ipcMain.on('install-mod', (event, url, ed) => {
    console.log('installing mod...');
    fs.mkdirSync(path.join(appDataPath, 'downloads'), { recursive: true });

    if (dbReadValue('engine' + ed) == undefined) {
        mmi.webContents.executeJavaScript('onEngineNotInstalled();');
        return;
    }

    const downloadPath = path.join(appDataPath, 'downloads', 'mod-' + btoa(url) + '.zip');

    progress(request(url))
        .on('progress', (state) => {
            console.log('percent: ' + Math.round(state.percent * 100) + '%');
            mmi.webContents.executeJavaScript('updateProgress("' + Math.round(state.percent * 100) + '%");');
        })
        .on('error', (err) => {
            console.error(err);
            mmi.webContents.executeJavaScript('onDownloadError();');
        })
        .on('end', () => {
            zl.extract(downloadPath, path.join(dbReadValue('engine' + ed), 'mods'), (err) => {
                if (err) {
                    console.error(err);
                    mmi.webContents.executeJavaScript('onDownloadError();');
                    return;
                }
                fs.rmSync(downloadPath, { recursive: true });
            });
            mmi.webContents.executeJavaScript('onDownloadComplete();');
        })
        .pipe(fs.createWriteStream(downloadPath));
});