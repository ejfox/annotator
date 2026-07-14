#!/usr/bin/env python3
"""Local dev server for the NewsWell Annotator.

    python3 serve.py        # → http://localhost:8000

Serves the static app AND provides an optional local persistence channel so your
edits land in a file on disk (annotations.local.json) instead of only the
browser's per-profile localStorage:

    POST /api/save   -> writes the current project to annotations.local.json
    GET  /api/load   -> returns it (the app prefers this when the server is up)

When the app is deployed static (GitHub Pages), these endpoints simply 404 and
the app falls back to localStorage. Progressive enhancement — no backend needed
in production, but a single source of truth locally.
"""
import os, json, http.server, socketserver, webbrowser, threading

BASE = os.path.dirname(os.path.abspath(__file__))
STORE = os.path.join(BASE, "annotations.local.json")
PORT = 8000


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=BASE, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/api/load"):
            if os.path.exists(STORE):
                try:
                    return self._json(json.load(open(STORE)))
                except Exception:
                    return self._json({})
            return self._json({})
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/save"):
            n = int(self.headers.get("Content-Length", 0))
            try:
                data = json.loads(self.rfile.read(n) or b"{}")
                json.dump(data, open(STORE, "w"), indent=1)
                return self._json({"ok": True})
            except Exception as e:
                return self._json({"ok": False, "error": str(e)}, 500)
        self.send_error(404)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    url = f"http://localhost:{PORT}"
    with socketserver.TCPServer(("127.0.0.1", PORT), H) as httpd:
        print(f"\n  NewsWell Annotator →  {url}")
        print(f"  Edits autosave to    →  {STORE}\n  Ctrl+C to stop.\n")
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Stopped.\n")
