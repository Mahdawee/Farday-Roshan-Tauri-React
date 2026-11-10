#!/usr/bin/env python3
"""Produce/check a review-only inventory from the checked-in MySQL schema.
No connection to a database; no company data, credentials, or SQL execution.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'database/schema.sql'
TARGET = ROOT / 'farday-next/contracts/legacy-schema.json'

def inventory():
    text = SOURCE.read_text(encoding='utf-8')
    tables = []
    for match in re.finditer(r'CREATE TABLE IF NOT EXISTS `([^`]+)`\s*\((.*?)\)\s*ENGINE=', text, re.S):
        name, body = match.groups()
        cols = []
        for line in body.splitlines():
            col = re.match(r'^\s*`([^`]+)`\s+(.+?)(?:,\s*)?$', line)
            if col:
                cols.append({'name': col.group(1), 'definition': col.group(2).rstrip(',')})
        if not cols:
            raise ValueError(f'No columns found for {name}')
        tables.append({'table': name, 'columns': cols})
    if len(tables) != 18 or len({t['table'] for t in tables}) != len(tables):
        raise ValueError('Schema changed: review parser and update inventory deliberately')
    return {'source': 'database/schema.sql', 'scope': 'DDL only; does not inspect deployed databases or rows', 'tables': tables}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='fail if the checked-in manifest differs')
    args = parser.parse_args()
    rendered = json.dumps(inventory(), ensure_ascii=False, indent=2) + '\n'
    if args.check:
        if not TARGET.exists() or TARGET.read_text(encoding='utf-8') != rendered:
            print('Legacy schema inventory differs; review and regenerate it.', file=sys.stderr)
            return 1
        print('Legacy schema inventory matches all 18 table definitions.')
    else:
        TARGET.write_text(rendered, encoding='utf-8')
        print(f'Wrote {TARGET.relative_to(ROOT)}')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
