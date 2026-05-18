# VHS Demo 1: The Full Picture
# Shows the complete `cronalytics all` chained output with paging
# Theme: Monokai Pro (high contrast, vibrant)
# Speed: Relaxed - let user absorb the full report

Output "/home/nick/builds/cronalytics/docs/demos/demo1-full-picture.gif"

Set Shell "bash"
Set Theme "Monokai Pro"
Set FontSize 26
Set Width 1600
Set Height 1000
Set Padding 20
Set TypingSpeed 50ms
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

# Type the command with paging
Type "cronalytics all --days 14 | more"
Sleep 500ms
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

# Add a pause at the end
Sleep 2s