# VHS Demo 5: Deep Dive Investigation
# Shows per-run analysis of a specific job - the detective feature
# Theme: Nord (cool, analytical)
# Speed: Deliberate - investigating

Output "/home/nick/builds/cronalytics/demos/demo5-deep-dive.gif"

Set Shell "bash"
Set Theme "nord"
Set FontSize 18
Set Width 1400
Set Height 900
Set Padding 20
Set TypingSpeed 40ms
Set PlaybackSpeed 1.0
Set Framerate 30

Hide
Type "cd /home/nick/builds/cronalytics"
Enter
Type "clear"
Enter
Show

Type "# Investigate a specific job's run history"
Enter
Sleep 200ms
Type "cronalytics runs --job 67541bf6e230 --days 14"
Sleep 300ms
Enter
Sleep 6s

Type "# Show as JSON for trend analysis"
Enter
Sleep 200ms
Type "cronalytics runs --job 67541bf6e230 --days 14 --json | jq '.data[] | {time: .run_time, cost: .estimated_cost_usd, tokens: .total_tokens, model}'"
Sleep 300ms
Enter
Sleep 4s

Sleep 2s
