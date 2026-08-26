"""Safe MongoDB/Atlas runtime diagnostic for Cloud Run.

Never prints the MongoDB URI or credentials. Exit status is always zero so this
is diagnostic-only and cannot block the application from starting.
"""
import os
import socket
import ssl
import sys
from urllib.parse import urlparse


def main():
    import pymongo

    uri = os.environ.get("MONGO_URL", "")
    print("=== Kuvira MongoDB Runtime Diagnostic ===", flush=True)
    print(f"python={sys.version.split()[0]}", flush=True)
    print(f"openssl={ssl.OPENSSL_VERSION}", flush=True)
    print(f"pymongo={pymongo.version}", flush=True)

    if not uri:
        print("mongo_uri=missing", flush=True)
        return

    try:
        parsed = urlparse(uri)
        host = parsed.hostname or ""
        print(f"mongo_host={host}", flush=True)

        try:
            addresses = socket.getaddrinfo(host, 27017, type=socket.SOCK_STREAM)
            ips = sorted({item[4][0] for item in addresses})
            print(f"dns=success addresses={ips}", flush=True)
        except Exception as exc:
            print(f"dns=failed error={type(exc).__name__}: {exc}", flush=True)

        try:
            client = pymongo.MongoClient(
                uri,
                serverSelectionTimeoutMS=10000,
                connectTimeoutMS=10000,
                socketTimeoutMS=10000,
                retryWrites=True,
            )
            result = client.admin.command("ping")
            print(f"mongo_ping=success ok={result.get('ok')}", flush=True)
            client.close()
        except Exception as exc:
            print(f"mongo_ping=failed error={type(exc).__name__}: {exc}", flush=True)

    except Exception as exc:
        print(f"diagnostic=failed error={type(exc).__name__}: {exc}", flush=True)


if __name__ == "__main__":
    main()
