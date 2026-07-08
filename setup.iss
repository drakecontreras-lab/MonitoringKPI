[Setup]
AppName=Monitoring KPIs Corporativos
AppVersion=1.0.0
AppPublisher=Monitoring SPA
DefaultDirName={autopf}\Monitoring KPIs Corporativos
DefaultGroupName=Monitoring KPIs Corporativos
DisableProgramGroupPage=yes
OutputBaseFilename=Instalador_Monitoring_KPIs_Corporativos
SetupIconFile=icon.ico
Compression=lzma
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "icon.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\Monitoring KPIs Corporativos\Monitoring KPIs Corporativos.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\Monitoring KPIs Corporativos\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Monitoring KPIs Corporativos"; Filename: "{app}\Monitoring KPIs Corporativos.exe"; IconFilename: "{app}\icon.ico"
Name: "{autodesktop}\Monitoring KPIs Corporativos"; Filename: "{app}\Monitoring KPIs Corporativos.exe"; Tasks: desktopicon; IconFilename: "{app}\icon.ico"

[Run]
Filename: "{app}\Monitoring KPIs Corporativos.exe"; Description: "{cm:LaunchProgram,Monitoring KPIs Corporativos}"; Flags: nowait postinstall skipifsilent
