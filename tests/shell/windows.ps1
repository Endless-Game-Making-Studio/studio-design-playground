# What the shell spec needs from Windows itself and can't get through the web
# engine: the app's windows, which one is in front, moving and resizing them,
# and real keyboard and mouse input. Prints JSON.
#   windows.ps1 list <processName>          windows with a title bar
#   windows.ps1 list-all <pid>              every visible window of a process and
#                                           its children (the web engine), menus included
#   windows.ps1 minimize <hwnd>
#   windows.ps1 maximize <hwnd>
#   windows.ps1 place <hwnd> <x> <y> <width> <height>
#   windows.ps1 close <hwnd>
#   windows.ps1 drag-corner <hwnd> <x> <y>
#   windows.ps1 keys <hwnd> <SendKeys text>
#   windows.ps1 right-click <hwnd> <x> <y>  x and y inside the window
#   windows.ps1 start <exe>                 runs it the way the Start menu would
param(
  [Parameter(Position = 0)] [string]$Command,
  [Parameter(ValueFromRemainingArguments = $true)] [string[]]$Rest
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class ShellWin {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }

  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc proc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hwnd, int index);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int max);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int cmd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int w, int h, uint flags);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT point);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, uint data, IntPtr extra);
  [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int pid);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, IntPtr extra);

  const int WS_CAPTION = 0x00C00000;

  public static List<IntPtr> TopLevel(HashSet<uint> pids, bool captionedOnly) {
    var found = new List<IntPtr>();
    EnumWindows((hwnd, _) => {
      uint pid;
      GetWindowThreadProcessId(hwnd, out pid);
      // A title bar leaves out the hidden helper windows the app keeps for
      // itself, such as the single-instance one.
      bool captioned = (GetWindowLong(hwnd, -16) & WS_CAPTION) == WS_CAPTION;
      if (pids.Contains(pid) && IsWindowVisible(hwnd) && (captioned || !captionedOnly)) found.Add(hwnd);
      return true;
    }, IntPtr.Zero);
    return found;
  }

  public static string Title(IntPtr hwnd) {
    var text = new StringBuilder(256);
    GetWindowText(hwnd, text, text.Capacity);
    return text.ToString();
  }
}
'@

function Hwnd([string]$value) { [IntPtr][long]$value }

function Rect([IntPtr]$hwnd) {
  $rect = New-Object ShellWin+RECT
  [void][ShellWin]::GetWindowRect($hwnd, [ref]$rect)
  $rect
}

# Input goes to the window in front, so put the app there first. Windows only
# lets the process that had the last input bring a window forward, so a tap of
# Shift makes this script that process. Not Alt, as the usual trick goes: Alt
# puts the window in menu mode, and the menu eats the next key.
function Front([IntPtr]$hwnd) {
  [ShellWin]::keybd_event(0xA0, 0, 0, [IntPtr]::Zero)
  [ShellWin]::keybd_event(0xA0, 0, 2, [IntPtr]::Zero)
  [void][ShellWin]::SetForegroundWindow($hwnd)
  # Keyboard focus reaches the web view a moment after the window comes to
  # the front; a key sent sooner is lost.
  Start-Sleep -Milliseconds 600
  if ([ShellWin]::GetForegroundWindow() -ne $hwnd) { throw "Couldn't bring window $hwnd to the front" }
}

function List($processes, [bool]$captionedOnly) {
  $pids = New-Object 'System.Collections.Generic.HashSet[uint32]'
  foreach ($p in $processes) { [void]$pids.Add([uint32]$p.Id) }
  $foreground = [ShellWin]::GetForegroundWindow()
  $windows = foreach ($hwnd in [ShellWin]::TopLevel($pids, $captionedOnly)) {
    $rect = Rect $hwnd
    [uint32]$owner = 0
    [void][ShellWin]::GetWindowThreadProcessId($hwnd, [ref]$owner)
    [pscustomobject]@{
      hwnd = [string][long]$hwnd
      pid = $owner
      title = [ShellWin]::Title($hwnd)
      foreground = ($hwnd -eq $foreground)
      minimized = [ShellWin]::IsIconic($hwnd)
      maximized = [ShellWin]::IsZoomed($hwnd)
      x = $rect.Left; y = $rect.Top
      width = $rect.Right - $rect.Left; height = $rect.Bottom - $rect.Top
    }
  }
  ConvertTo-Json -Compress -Depth 3 @{ processes = @($processes | ForEach-Object { $_.Id }); windows = @($windows) }
}

function Click([uint32]$down, [uint32]$up) {
  [ShellWin]::mouse_event($down, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 50
  [ShellWin]::mouse_event($up, 0, 0, 0, [IntPtr]::Zero)
}

switch ($Command) {
  'list' { List @(Get-Process -Name $Rest[0] -ErrorAction SilentlyContinue) $true }
  'list-all' {
    $all = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
    $family = @([uint32]$Rest[0])
    do {
      $before = $family.Count
      $family = @($family + ($all | Where-Object { $family -contains $_.ParentProcessId -and $family -notcontains $_.ProcessId } | ForEach-Object { [uint32]$_.ProcessId }))
    } while ($family.Count -gt $before)
    List @($family | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }) $false
  }
  # SW_MINIMIZE (6)
  'minimize' { [void][ShellWin]::ShowWindow((Hwnd $Rest[0]), 6); '{}' }
  # SW_MAXIMIZE (3)
  'maximize' { [void][ShellWin]::ShowWindow((Hwnd $Rest[0]), 3); '{}' }
  'place' {
    # SW_RESTORE (9) first: a maximised window ignores a new size.
    [void][ShellWin]::ShowWindow((Hwnd $Rest[0]), 9)
    # SWP_NOZORDER (0x4) | SWP_NOACTIVATE (0x10)
    [void][ShellWin]::SetWindowPos((Hwnd $Rest[0]), [IntPtr]::Zero, [int]$Rest[1], [int]$Rest[2], [int]$Rest[3], [int]$Rest[4], 0x14)
    '{}'
  }
  # WM_CLOSE (0x10): the same as the title bar's close button.
  'close' { [void][ShellWin]::PostMessage((Hwnd $Rest[0]), 0x10, [IntPtr]::Zero, [IntPtr]::Zero); '{}' }
  'drag-corner' {
    # Resizes the way a person does, by dragging the bottom-right corner to a
    # point on screen. `place` would skip the minimum size: Windows only
    # applies it while someone is resizing. Moves the real pointer for a
    # moment, and puts it back after.
    $hwnd = Hwnd $Rest[0]
    Front $hwnd
    $rect = Rect $hwnd
    $was = New-Object ShellWin+POINT
    [void][ShellWin]::GetCursorPos([ref]$was)
    # Just inside the frame's outer edge, where the resize border is.
    $fromX = $rect.Right - 3; $fromY = $rect.Bottom - 3
    $toX = [int]$Rest[1]; $toY = [int]$Rest[2]
    [void][ShellWin]::SetCursorPos($fromX, $fromY)
    Start-Sleep -Milliseconds 100
    [ShellWin]::mouse_event(0x2, 0, 0, 0, [IntPtr]::Zero) # MOUSEEVENTF_LEFTDOWN
    for ($step = 1; $step -le 10; $step++) {
      [void][ShellWin]::SetCursorPos([int]($fromX + ($toX - $fromX) * $step / 10), [int]($fromY + ($toY - $fromY) * $step / 10))
      Start-Sleep -Milliseconds 30
    }
    [ShellWin]::mouse_event(0x4, 0, 0, 0, [IntPtr]::Zero) # MOUSEEVENTF_LEFTUP
    Start-Sleep -Milliseconds 100
    [void][ShellWin]::SetCursorPos($was.X, $was.Y)
    '{}'
  }
  'keys' {
    # Real key presses, through the same path a keyboard takes, so the web
    # engine's own shortcuts (reload, zoom, developer tools) see them too.
    Front (Hwnd $Rest[0])
    [System.Windows.Forms.SendKeys]::SendWait($Rest[1])
    Start-Sleep -Milliseconds 300
    '{}'
  }
  'right-click' {
    $hwnd = Hwnd $Rest[0]
    Front $hwnd
    $rect = Rect $hwnd
    $was = New-Object ShellWin+POINT
    [void][ShellWin]::GetCursorPos([ref]$was)
    [void][ShellWin]::SetCursorPos($rect.Left + [int]$Rest[1], $rect.Top + [int]$Rest[2])
    Start-Sleep -Milliseconds 100
    Click 0x8 0x10 # MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP
    Start-Sleep -Milliseconds 500
    [void][ShellWin]::SetCursorPos($was.X, $was.Y)
    '{}'
  }
  'start' {
    # A program started from the Start menu or Explorer may take the
    # foreground, because the shell had it. This script stands in for the shell:
    # the Shift tap gives it the right, and it passes the right on to whatever
    # it starts. Waits for the program to exit and prints its exit code.
    [ShellWin]::keybd_event(0xA0, 0, 0, [IntPtr]::Zero)
    [ShellWin]::keybd_event(0xA0, 0, 2, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 100
    [void][ShellWin]::AllowSetForegroundWindow(-1) # ASFW_ANY
    $started = Start-Process -FilePath $Rest[0] -PassThru -Wait
    ConvertTo-Json -Compress @{ exitCode = $started.ExitCode }
  }
  default { throw "Unknown command: $Command" }
}
