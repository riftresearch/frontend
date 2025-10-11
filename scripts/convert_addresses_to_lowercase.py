#!/usr/bin/env python3
"""
Script to convert all Ethereum addresses to lowercase in token data files.
This script processes:
- address_to_metadata.json: converts keys to lowercase
- names_to_address.json: converts values to lowercase  
- tickers_to_address.json: converts values to lowercase
"""

import json
import os
from pathlib import Path

def convert_address_to_metadata(file_path):
    """Convert address keys to lowercase in address_to_metadata.json files"""
    print(f"Processing {file_path}...")
    
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    # Create new dict with lowercase keys
    new_data = {}
    for address, metadata in data.items():
        new_data[address.lower()] = metadata
    
    # Write back to file
    with open(file_path, 'w') as f:
        json.dump(new_data, f, indent=2)
    
    print(f"  Converted {len(new_data)} addresses to lowercase")

def convert_names_to_address(file_path):
    """Convert address values to lowercase in names_to_address.json files"""
    print(f"Processing {file_path}...")
    
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    # Convert values to lowercase
    new_data = {}
    for name, address in data.items():
        new_data[name] = address.lower()
    
    # Write back to file
    with open(file_path, 'w') as f:
        json.dump(new_data, f, indent=2)
    
    print(f"  Converted {len(new_data)} addresses to lowercase")

def convert_tickers_to_address(file_path):
    """Convert address values to lowercase in tickers_to_address.json files"""
    print(f"Processing {file_path}...")
    
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    # Convert values to lowercase
    new_data = {}
    for ticker, address in data.items():
        new_data[ticker] = address.lower()
    
    # Write back to file
    with open(file_path, 'w') as f:
        json.dump(new_data, f, indent=2)
    
    print(f"  Converted {len(new_data)} addresses to lowercase")

def main():
    """Main function to process all token data files"""
    # Get the script directory and navigate to project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    base_path = project_root / "utils/tokenData"
    
    # Process specific chain IDs
    chain_ids = ["1", "8453"]
    
    for chain_id in chain_ids:
        chain_dir = base_path / chain_id
        if chain_dir.exists():
            print(f"\nProcessing chain {chain_id}...")
            
            # Process address_to_metadata.json
            address_metadata_file = chain_dir / "address_to_metadata.json"
            if address_metadata_file.exists():
                convert_address_to_metadata(address_metadata_file)
            
            # Process names_to_address.json
            names_address_file = chain_dir / "names_to_address.json"
            if names_address_file.exists():
                convert_names_to_address(names_address_file)
            
            # Process tickers_to_address.json
            tickers_address_file = chain_dir / "tickers_to_address.json"
            if tickers_address_file.exists():
                convert_tickers_to_address(tickers_address_file)
        else:
            print(f"Warning: Chain directory {chain_id} not found at {chain_dir}")
    
    print("\n✅ All token data files have been processed!")

if __name__ == "__main__":
    main()
