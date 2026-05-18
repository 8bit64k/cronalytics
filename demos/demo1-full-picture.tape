# VHS Demo 1: The Full Picture
# Shows the complete `cronalytics all` chained output
# Theme: Catppuccin Mocha (dark, modern)
# Speed: Relaxed - let user absorb the full report

Output "/home/nick/builds/cronalytics/demos/demo1-full-picture.gif"

Set Shell "bash"
Set Theme "Catppuccin Mocha"
Set FontSize 18
Set Width 1400
Set Height 900
Set Padding 20
Set TypingSpeed 50ms
Set PlaybackSpeed 1.0
Set Framerate 30

Hide
Type "cd /home/nick/builds/cronalytics"
Enter
Type "clear"
Enter
Show

# Type the command with a slight pause for readability
Type "cronalytics all --days 14"
Sleep 500ms
Enter

# Wait for the full output to render
Sleep 8s

# Add a pause at the end
Sleep 2s
