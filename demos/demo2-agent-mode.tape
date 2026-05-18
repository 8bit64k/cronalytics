# VHS Demo 2: Agent Mode - Find the Burners
# Shows JSON output piped through jq for agent consumption
# Theme: Dracula (dark, developer-friendly)
# Speed: Snappy - agents work fast

Output "/home/nick/builds/cronalytics/demos/demo2-agent-mode.gif"

Set Shell "bash"
Set Theme "Dracula"
Set FontSize 18
Set Width 1400
Set Height 700
Set Padding 20
Set TypingSpeed 30ms
Set PlaybackSpeed 1.2
Set Framerate 30

Hide
Type "cd /home/nick/builds/cronalytics"
Enter
Type "clear"
Enter
Show

Type "# Agent Mode: pipe JSON to jq, find jobs running hot"
Enter
Sleep 200ms
Type "cronalytics jobs --days 30 --json | jq '.data[] | select(.pace > 1.0) | {name: .job_name, pace, cost: .total_cost, runs}'"
Sleep 300ms
Enter
Sleep 4s

Type "# Find top 3 most expensive jobs"
Enter
Sleep 200ms
Type "cronalytics jobs --days 30 --json | jq '.data | sort_by(.total_cost) | reverse | .[0:3]'"
Sleep 300ms
Enter
Sleep 3s

Sleep 2s
