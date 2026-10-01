[private]
default:
    @just --list

# Vite dev server: auto-reloads on deck/chapter edits; landing page at http://localhost:<port>/.
# Serve the slides locally (`just serve`, or `just serve 8001` for another port)
serve port="8000":
    npm start --port={{port}}
