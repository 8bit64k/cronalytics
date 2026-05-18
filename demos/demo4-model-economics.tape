# VHS Demo 4: Model Economics
# Shows cost breakdown by model - which LLM burns the most money
# Theme: Tokyo Night (sleek, modern)
# Speed: Medium - let the bars sink in

Output "/home/nick/builds/cronalytics/demos/demo4-model-economics.gif"

Set Shell "bash"
Set Theme "TokyoNight"
Set FontSize 18
Set Width 1400
Set Height 700
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

Type "# Which model is eating your budget?"
Enter
Sleep 200ms
Type "cronalytics models --days 30"
Sleep 300ms
Enter
Sleep 5s

Type "# JSON for programmatic analysis"
Enter
Sleep 200ms
Type "cronalytics models --days 30 --json | jq '.data[] | {model, runs, cost: .total_cost, tokens: .total_tokens}'"
Sleep 300ms
Enter
Sleep 3s

Sleep 2s
