# VHS Demo 5: Deep Dive Investigation
# Shows per-run analysis of a specific job - the detective feature
# Theme: Oceanic-Next (high contrast blue)
# Speed: Deliberate - investigating

Output "/home/nick/builds/cronalytics/docs/demos/demo5-deep-dive.gif"

Set Shell "bash"
Set Theme "Oceanic-Next"
Set FontSize 26
Set Width 1600
Set Height 1000
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

Type "# Investigate a specific job's run history"
Enter
Sleep 200ms
Type "cronalytics runs --job _demo_f1561526d8 --days 14 | more"
Sleep 300ms
Enter

# Linger on first page
Sleep 3s

# Page down
Space
Sleep 2s

# Page down again
Space
Sleep 2s

# Page down again
Space
Sleep 2s

Type "# Show as JSON for trend analysis"
Enter
Sleep 200ms
Type "cronalytics runs --job _demo_f1561526d8 --days 14 --json | jq '.data[] | {time: .run_time, cost: .estimated_cost_usd, tokens: .total_tokens, model}'"
Sleep 300ms
Enter
Sleep 4s

Sleep 2s