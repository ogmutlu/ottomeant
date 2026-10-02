#!/usr/bin/env python3
"""Bind the development server before announcing its URL."""

import argparse
import errno
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("port", type=int)
    parser.add_argument("--fallback", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("port must be between 1 and 65535")

    directory = Path(__file__).resolve().parent.parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
    ports = range(args.port, min(args.port + 20, 65536)) if args.fallback else [args.port]
    server = None
    for port in ports:
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), handler)
            break
        except OSError as error:
            if error.errno != errno.EADDRINUSE:
                print(f"Cannot start the server: {error}", file=sys.stderr)
                return 1
            if not args.fallback:
                print(
                    f"Port {port} is already in use. Try ./serve.sh with another port, "
                    "for example ./serve.sh 8080.",
                    file=sys.stderr,
                )
                return 1
    if server is None:
        print("No available port near 8000. Choose a port with ./serve.sh <port>.", file=sys.stderr)
        return 1

    with server:
        port = server.server_address[1]
        if port != args.port:
            print(f"Port {args.port} is occupied; using {port} instead.", flush=True)
        print(f"\nOttomeant: http://127.0.0.1:{port}\nPress Ctrl+C to stop.\n", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
