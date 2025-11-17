\
; NSIS installer script for Desktop World V5
Name "Desktop World V5"
OutFile "DesktopWorldV5_Installer.exe"
InstallDir "$PROGRAMFILES\DesktopWorldV5"
Page directory
Page instfiles
Section "Install"
  SetOutPath "$INSTDIR"
  File /r "*.*"
  ; Create a shortcut to start.bat
  CreateShortCut "$DESKTOP\DesktopWorldV5.lnk" "$INSTDIR\start.bat"
SectionEnd
