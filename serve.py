#!/usr/bin/env python3
"""Optional static dev server for the NewsWell Annotator.

    python3 serve.py        # → http://localhost:8000

The app is fully static (no API); this just serves the folder over http so the
JSON config files fetch cleanly. Deploy is the same static files on any host.
"""
import os, http.server, socketserver, webbrowser, threading

BASE = os.path.dirname(os.path.abspath(__file__))
PORT = 8000


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=BASE, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    url = f"http://localhost:{PORT}"
    with socketserver.TCPServer(("127.0.0.1", PORT), H) as httpd:
        print(f"\n  NewsWell Annotator →  {url}\n  Ctrl+C to stop.\n")
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Stopped.\n")
