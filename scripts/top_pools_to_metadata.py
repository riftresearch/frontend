import json
import sys
import time
from pathlib import Path
from typing import Dict, Tuple, List, Set

import requests


# CoinGecko Onchain API v3 (Pro)
API_BASE = "https://pro-api.coingecko.com/api/v3/onchain"

# Networks and their output directories (fixed; no CLI args besides API key)
NETWORKS = {
    "eth": "1",      # Ethereum
    "base": "8453",  # Base
}


def _load_json(path: Path) -> dict:
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, sort_keys=True)


def fetch_top_pools_tokens(api_key: str, network: str, max_pools: int = 1000, per_page: int = 20, delay_every: int = 5, sleep_seconds: float = 2.0) -> Tuple[Dict[str, dict], List[str]]:
    """
    Fetch tokens referenced by top pools for a given network from GeckoTerminal.

    Returns a mapping of lowercased token address -> token attributes dict
    (containing at least name, symbol, decimals, image_url when available).
    """
    tokens: Dict[str, dict] = {}
    tickers_processed: Set[str] = set()
    total_pages = (max_pools + per_page - 1) // per_page

    for page in range(1, total_pages + 1):
        url = f"{API_BASE}/networks/{network}/pools"
        params = {
            "include": "base_token,quote_token",
            "page": page,
            "sort": "h24_volume_usd_desc",
        }
        headers = {"x-cg-pro-api-key": api_key}
        resp = requests.get(url, params=params, headers=headers, timeout=20)
        resp.raise_for_status()
        payload = resp.json()

        # Index included tokens by id for pool logging and collect token metadata by address
        included_index = {}
        for inc in payload.get("included", []):
            # print(inc)
            attr = inc.get("attributes") or {}
            tok_id = inc.get("id")
            addr = (attr.get("address") or "").lower()
            if not addr:
                continue

            # Store/overwrite in local cache of fetched tokens only (not the file)
            # Latest occurrence wins here, but we only append to on-disk if missing.
            tokens[addr] = {
                "name": attr.get("name"),
                "ticker": attr.get("symbol"),
                "icon": attr.get("image_url"),
                "decimals": attr.get("decimals"),
            }

            if tok_id:
                included_index[tok_id] = attr

        # Log base/quote tickers per pool
        for pool in payload.get("data", []):
            rel = pool.get("relationships", {}) or {}
            base_rel = (rel.get("base_token") or {}).get("data") or {}
            quote_rel = (rel.get("quote_token") or {}).get("data") or {}
            base_attr = included_index.get(base_rel.get("id"), {})
            quote_attr = included_index.get(quote_rel.get("id"), {})
            base_sym = base_attr.get("symbol")
            quote_sym = quote_attr.get("symbol")
            print(f"Pool: {base_sym or 'UNKNOWN'} / {quote_sym or 'UNKNOWN'}")
            if base_sym:
                tickers_processed.add(base_sym)
            if quote_sym:
                tickers_processed.add(quote_sym)

        # Respect rate limits with periodic delays
        if page % delay_every == 0:
            time.sleep(sleep_seconds)

    return tokens, sorted(tickers_processed)


def append_tokens_to_metadata(tokens: Dict[str, dict], out_path: Path) -> Tuple[int, int, int]:
    """
    Append tokens to address_to_metadata.json without overwriting existing values.
    - If address exists: only add 'decimals' if missing.
    - If address does not exist: add with name, ticker, icon, decimals.

    Returns (existing_updated, newly_added, total_seen)
    """
    mapping = _load_json(out_path)
    existing_updated = 0
    newly_added = 0

    for addr, meta in tokens.items():
        if addr in mapping:
            # Do not overwrite existing fields; only add decimals if missing
            if isinstance(mapping[addr], dict) and "decimals" not in mapping[addr]:
                dec = meta.get("decimals")
                if dec is not None:
                    mapping[addr]["decimals"] = dec
                    existing_updated += 1
        else:
            mapping[addr] = {
                "name": meta.get("name"),
                "ticker": meta.get("ticker"),
                "icon": meta.get("icon"),
                "decimals": meta.get("decimals"),
            }
            newly_added += 1

    _write_json(out_path, mapping)
    return existing_updated, newly_added, len(tokens)


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python scripts/top_pools_to_metadata.py <COINGECKO_PRO_API_KEY>")
        sys.exit(1)

    api_key = sys.argv[1]
    repo_root = Path(__file__).resolve().parent.parent

    all_tickers: Set[str] = set()

    for network, chain_dir in NETWORKS.items():
        print(f"Fetching top pools tokens for network={network}...")
        tokens, tickers = fetch_top_pools_tokens(api_key, network)
        all_tickers.update(tickers)

        out_path = repo_root / "src" / "utils" / "tokenData" / chain_dir / "address_to_metadata.json"
        updated, added, seen = append_tokens_to_metadata(tokens, out_path)
        print(
            f"Network {network}: processed {seen} tokens; added {added}, updated existing decimals {updated}. Output: {out_path}"
        )

    # Final array of all unique tickers processed across networks
    print(json.dumps(sorted(all_tickers)))


if __name__ == "__main__":
    main()
