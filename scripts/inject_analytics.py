#!/usr/bin/env python3
"""Inject the optional Cloudflare Web Analytics token into a deploy copy."""
import os
import re
import sys
from pathlib import Path

def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: inject_analytics.py <museum-config.js>")
    path=Path(sys.argv[1])
    token=os.environ.get("CLOUDFLARE_ANALYTICS_TOKEN","").strip()
    if not token:
        print("Cloudflare Web Analytics remains disabled: no repository variable/secret configured.")
        return
    text=path.read_text(encoding="utf-8")
    replacement="cloudflareAnalyticsToken:"+repr(token)
    text,count=re.subn(r"cloudflareAnalyticsToken:'[^']*'",replacement,text,count=1)
    if count != 1:
        raise SystemExit("cloudflareAnalyticsToken placeholder not found")
    path.write_text(text,encoding="utf-8")
    print("Cloudflare Web Analytics token injected into deployment copy.")

if __name__=="__main__":
    main()
