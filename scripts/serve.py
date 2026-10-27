#!/usr/bin/env python3
"""Serve the project locally without reusing stale application code."""
import argparse
import functools
import http.server
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent


class DevelopmentHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        path = urlsplit(self.path).path
        if path.endswith(('.html', '.js', '.css')) or path.endswith('/'):
            self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def send_head(self):
        path = urlsplit(self.path).path
        if path.endswith(('.html', '.js', '.css')) or path.endswith('/'):
            # A stale browser validator must not select a 304 response for code.
            del self.headers['If-Modified-Since']
            del self.headers['If-None-Match']
        return super().send_head()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    handler = functools.partial(DevelopmentHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer((args.host, args.port), handler) as server:
        print(f'Suburban: http://{args.host}:{server.server_port}/', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
