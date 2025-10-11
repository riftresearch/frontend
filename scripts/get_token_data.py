#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
from collections import defaultdict, OrderedDict
from typing import Dict, List, Optional
import requests
import random

def _sleep_with_jitter(seconds: float):
    # Full jitter: U(0, seconds)
    time.sleep(random.uniform(0, max(0.0, seconds)))


SELECTOR_NAME   = "0x06fdde03"   # name()
SELECTOR_SYMBOL = "0x95d89b41"   # symbol()

def is_valid_addr(addr: str) -> bool:
    return isinstance(addr, str) and addr.startswith("0x") and len(addr) == 42

def hex_to_bytes(s: str) -> bytes:
    s = s[2:] if s.startswith("0x") else s
    if len(s) % 2 == 1:
        s = "0" + s
    return bytes.fromhex(s)

def try_decode_string_return(data_hex: str) -> Optional[str]:
    if not data_hex or data_hex == "0x":
        return None
    b = hex_to_bytes(data_hex)

    # bytes32 (static)
    if len(b) == 32:
        raw = b.rstrip(b"\x00")
        try:
            s = raw.decode("utf-8", errors="strict")
            return s if s else None
        except UnicodeDecodeError:
            return None

    # dynamic string: offset | length | data
    if len(b) >= 96:
        try:
            offset = int.from_bytes(b[0:32], "big")
            if offset + 32 > len(b):
                return None
            strlen = int.from_bytes(b[offset:offset+32], "big")
            start = offset + 32
            end = start + strlen
            if end > len(b):
                return None
            raw = b[start:end]
            s = raw.decode("utf-8", errors="strict")
            return s if s else None
        except Exception:
            return None

    # some nodes return only (length|data)
    if len(b) >= 32:
        try:
            strlen = int.from_bytes(b[0:32], "big")
            start = 32
            end = start + strlen
            if end <= len(b):
                raw = b[start:end]
                s = raw.decode("utf-8", errors="strict")
                return s if s else None
        except Exception:
            pass
    return None

def build_eth_call(to_addr: str, selector: str, req_id: int) -> Dict:
    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "method": "eth_call",
        "params": [{"to": to_addr, "data": selector}, "latest"],
    }

def rpc_batch_call(rpc_url: str, payload: List[Dict], timeout: int = 45,
                   max_retries: int = 6,
                   backoff_initial: float = 0.5,
                   backoff_max: float = 8.0) -> List[Dict]:
    """
    Robust JSON-RPC batch call with retry/backoff on 429/5xx/timeouts.
    Honors Retry-After if provided. Uses full-jitter exponential backoff.
    """
    headers = {"Content-Type": "application/json"}

    attempt = 0
    backoff = backoff_initial

    while True:
        try:
            resp = requests.post(rpc_url, headers=headers, data=json.dumps(payload), timeout=timeout)
        except (requests.Timeout, requests.ConnectionError) as e:
            if attempt >= max_retries:
                raise
            attempt += 1
            _sleep_with_jitter(min(backoff, backoff_max))
            backoff = min(backoff * 2, backoff_max)
            continue

        # Rate limit handling
        if resp.status_code == 429:
            if attempt >= max_retries:
                resp.raise_for_status()  # surface the 429
            attempt += 1
            # Respect Retry-After if present
            retry_after = resp.headers.get("Retry-After")
            if retry_after:
                try:
                    wait = float(retry_after)
                except ValueError:
                    wait = backoff
            else:
                wait = backoff
            _sleep_with_jitter(min(wait, backoff_max))
            backoff = min(backoff * 2, backoff_max)
            continue

        # Transient 5xx
        if 500 <= resp.status_code < 600:
            if attempt >= max_retries:
                resp.raise_for_status()
            attempt += 1
            _sleep_with_jitter(min(backoff, backoff_max))
            backoff = min(backoff * 2, backoff_max)
            continue

        # Non-retryable HTTP
        resp.raise_for_status()

        # Success path
        out = resp.json()
        if not isinstance(out, list):
            out = [out]
        out.sort(key=lambda x: x.get("id", 0))
        return out


def chunks(lst: List[str], n: int):
    for i in range(0, len(lst), n):
        yield lst[i:i+n]

def load_addresses_from_file(path: str) -> List[str]:
    """
    File can contain comma-separated addresses, with optional newlines/spaces.
    """
    with open(path, "r") as f:
        raw = f.read()
    # Split by commas first, then strip whitespace/newlines
    tokens = []
    for part in raw.split(","):
        tok = part.strip()
        if not tok:
            continue
        # also allow newline-separated (in case no commas)
        if "\n" in tok:
            for sub in tok.split():
                if sub.strip():
                    tokens.append(sub.strip())
        else:
            tokens.append(tok)
    # de-dupe preserving order
    seen = set()
    out: List[str] = []
    for a in tokens:
        if a not in seen:
            seen.add(a)
            out.append(a)
    return out

def make_icon_url(chain_id: int, address: str) -> str:
    return f"https://assets.smold.app/api/token/{chain_id}/{address.lower()}/logo-128.png"

def fetch_metadata_one_chain(
    rpc_url: str,
    chain_id: int,
    addresses: List[str],
    batch_size: int = 50,
    sleep_between: float = 0.0,
    max_retries: int = 6,
    backoff_initial: float = 0.5,
    backoff_max: float = 8.0,
    verbose: bool = False,
) -> Dict[str, Dict[str, Optional[str]]]:
    """
    Returns address -> { name, ticker }
    """
    out: Dict[str, Dict[str, Optional[str]]] = OrderedDict()
    valid = [a for a in addresses if is_valid_addr(a)]
    invalid = [a for a in addresses if not is_valid_addr(a)]
    for a in invalid:
        out[a] = {"name": None, "ticker": None}  # keep placeholders for visibility

    id_counter = 1
    for group in chunks(valid, batch_size):
        batch = []
        id_map = {}
        for addr in group:
            c1 = build_eth_call(addr, SELECTOR_NAME, id_counter); id_map[id_counter] = (addr, "name");   id_counter += 1
            c2 = build_eth_call(addr, SELECTOR_SYMBOL, id_counter); id_map[id_counter] = (addr, "ticker"); id_counter += 1
            batch.extend([c1, c2])

        try:
            if verbose:
                print(f"[batch] Fetching {len(group)} addresses (chain {chain_id})...", file=sys.stderr)

            replies = rpc_batch_call(
                rpc_url,
                batch,
                timeout=45,
                max_retries=max_retries,
                backoff_initial=backoff_initial,
                backoff_max=backoff_max,
            )
        except requests.HTTPError as e:
            # if batch fails, leave this group's entries as None
            for addr in group:
                out.setdefault(addr, {"name": None, "ticker": None})
            print(f"[warn] RPC batch failed (first addr {group[0]}): {e}", file=sys.stderr)
            if sleep_between:
                time.sleep(sleep_between)
            continue

        # init defaults
        for addr in group:
            out.setdefault(addr, {"name": None, "ticker": None})

        for item in replies:
            _id = item.get("id")
            if _id not in id_map:
                continue
            addr, field = id_map[_id]
            if "error" in item:
                if verbose:
                    print(f"[error] {addr} {field} -> {item['error']}", file=sys.stderr)
                continue
            decoded = try_decode_string_return(item.get("result"))
            if decoded is not None and decoded.strip() == "":
                decoded = None
            key = "ticker" if field == "ticker" else "name"
            out[addr][key] = decoded
            if verbose:
                print(f"[ok] {addr} {key} = {decoded}", file=sys.stderr)

        if sleep_between:
            time.sleep(sleep_between)

    return out

def build_outputs(chain_id: int, meta_by_addr: Dict[str, Dict[str, Optional[str]]]):
    """
    Returns:
      address_to_metadata (address -> {name,ticker,icon}),
      names_map (Name/Name2 -> address),
      tickers_map (SYM/SYM2 -> address)
    """
    address_to_metadata: Dict[str, Dict[str, Optional[str]]] = OrderedDict()
    names_map: Dict[str, str] = OrderedDict()
    tickers_map: Dict[str, str] = OrderedDict()
    name_counts: Dict[str, int] = defaultdict(int)
    ticker_counts: Dict[str, int] = defaultdict(int)

    for addr, nt in meta_by_addr.items():
        name = nt.get("name")
        ticker = nt.get("ticker")
        address_to_metadata[addr] = {
            "name": name,
            "ticker": ticker,
            "icon": make_icon_url(chain_id, addr),
        }

        if name and name.strip():
            base = name.strip()
            key_lower = base.lower()
            name_counts[key_lower] += 1
            idx = name_counts[key_lower]
            key = base if idx == 1 else f"{base}{idx}"
            names_map[key] = addr

        if ticker and ticker.strip():
            base = ticker.strip()
            key_lower = base.lower()
            ticker_counts[key_lower] += 1
            idx = ticker_counts[key_lower]
            key = base if idx == 1 else f"{base}{idx}"
            tickers_map[key] = addr

    return address_to_metadata, names_map, tickers_map

def write_json(path: str, data, pretty: bool):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        if pretty:
            json.dump(data, f, indent=2)
        else:
            json.dump(data, f, separators=(",", ":"))

def parse_args():
    p = argparse.ArgumentParser(description="Fetch ERC-20 metadata for a single chain and write 3 JSON outputs.")
    p.add_argument("--chain", type=int, required=True, help="Chain ID (e.g., 1 for Ethereum mainnet).")
    p.add_argument("--rpc", required=True, help="HTTPS JSON-RPC endpoint for the specified chain (e.g., QuickNode URL).")
    p.add_argument("--file", required=True, help="Path to file containing token addresses separated by commas (newlines/whitespace OK).")
    p.add_argument("--out-root", default=".", help="Root output directory. Script creates <out-root>/<chain>/ with 3 files.")
    p.add_argument("--batch-size", type=int, default=50, help="Batch size for JSON-RPC calls.")
    p.add_argument("--sleep", type=float, default=0.0, help="Seconds to sleep between batches.")
    p.add_argument("--pretty", action="store_true", help="Pretty-print JSON outputs.")
    p.add_argument("--max-retries", type=int, default=6, help="Max retry attempts per batch when rate-limited or transient errors occur.")
    p.add_argument("--backoff-initial", type=float, default=0.5, help="Initial backoff seconds for retries.")
    p.add_argument("--backoff-max", type=float, default=8.0, help="Max backoff seconds.")
    p.add_argument("--verbose", action="store_true", help="Log every token query and result.")

    return p.parse_args()

def main():
    args = parse_args()

    addresses = load_addresses_from_file(args.file)
    if not addresses:
        print("Error: no addresses found in file.", file=sys.stderr)
        sys.exit(1)

    meta = fetch_metadata_one_chain(
        rpc_url=args.rpc,
        chain_id=args.chain,
        addresses=addresses,
        batch_size=args.batch_size,
        sleep_between=args.sleep,
        max_retries=args.max_retries,
        backoff_initial=args.backoff_initial,
        backoff_max=args.backoff_max,
        verbose=args.verbose,
    )

    address_to_metadata, names_map, tickers_map = build_outputs(args.chain, meta)

    out_dir = os.path.join(args.out_root, str(args.chain))
    write_json(os.path.join(out_dir, "address_to_metadata.json"), address_to_metadata, args.pretty)
    write_json(os.path.join(out_dir, "names_to_address.json"),    names_map,           args.pretty)
    write_json(os.path.join(out_dir, "tickers_to_address.json"),  tickers_map,         args.pretty)

    print(f"Wrote files to {out_dir}:\n"
          f"  - address_to_metadata.json\n"
          f"  - names_to_address.json\n"
          f"  - tickers_to_address.json")

if __name__ == "__main__":
    main()
