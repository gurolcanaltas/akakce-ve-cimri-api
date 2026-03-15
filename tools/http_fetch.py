import argparse
import json
import sys


def write_payload(payload):
    sys.stdout.buffer.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description="Fetch HTML with curl_cffi.")
    parser.add_argument("--url", required=True)
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--impersonate", default="chrome")
    args = parser.parse_args()

    try:
        from curl_cffi import requests
    except ImportError as exc:
        raise RuntimeError(
            "curl_cffi is required. Install it with: ..\\tools\\python311\\python.exe -m pip install curl_cffi"
        ) from exc

    response = requests.get(
        args.url,
        impersonate=args.impersonate,
        timeout=args.timeout,
        headers={
            "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )

    payload = {
        "ok": 200 <= response.status_code < 400,
        "status": response.status_code,
        "url": response.url,
        "html": response.content.decode("utf-8", errors="replace"),
    }
    write_payload(payload)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        write_payload({"ok": False, "error": str(exc)})
