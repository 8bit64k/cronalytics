# VHS Demo 3: The Failure Hunt
# Shows filtering by failure outcome and finding wasted spend
# Theme: Blazer (high contrast dark)
# Speed: Measured - investigative

Output "/home/nick/builds/cronalytics/docs/demos/demo3-failure-hunt.gif"

Set Shell "bash"
Set Theme "Blazer"
Set FontSize 26
Set Width 1600
Set Height 900
Set Padding 20
Set TypingSpeed 40ms
Set PlaybackSpeed 1.0
Set Framerate 30

Hide
Type "export HERMES_HOME=/home/nick/builds/cronalytics/docs/demos"
Enter
Type "cd /home/nick/builds/cronalytics"
Enter
Type "clear"
Enter
Show

Type "# Find failures and wasted cost"
Enter
Sleep 200ms
Type "cronalytics summary --days 14 --outcome failure"
Sleep 300ms
Enter
Sleep 4s

Type "# Drill into failure jobs with JSON"
Enter
Sleep 200ms
Type "cronalytics jobs --days 14 --outcome failure --json | jq '.data[] | {name: .job_name, runs, cost: .total_cost}'"
Sleep 300ms
Enter
Sleep 3s

Sleep 2s