Set WshShell = CreateObject("WScript.Shell")
Dim fso, strScriptDir, strDaemonJs
Set fso = CreateObject("Scripting.FileSystemObject")
strScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
strDaemonJs = fso.BuildPath(strScriptDir, "sia247Daemon.js")

' Run node.exe hidden (0 = hide window, false = do not wait)
WshShell.Run "node """ & strDaemonJs & """", 0, False
