#!/usr/bin/env python3
"""Check review artifacts only; does NOT execute PHP, Rust, or real accounting data."""
import json
import unittest
from decimal import Decimal
from pathlib import Path
from schema_inventory import inventory, TARGET

BASE = Path(__file__).resolve().parents[1]
D = Decimal

class ReviewChecks(unittest.TestCase):
    def test_inventory_matches_schema_and_covers_all_legacy_tables(self):
        actual = inventory()
        self.assertEqual(actual, json.loads(TARGET.read_text(encoding='utf-8')))
        self.assertEqual({t['table'] for t in actual['tables']}, {
            'company','machines','settings','employees','attendance','customers',
            'material_types','expense_types','payers','receipt_sources',
            'sales','expenses','receipts','salaries','users','counters','report_notes','activity_log'
        })
    def test_example_arithmetic_and_legacy_ledger_discrepancy(self):
        f = json.loads((BASE/'contracts/financial-example.json').read_text(encoding='utf-8'))
        sale = f['credit_sale']; total = D(sale['volume']) * (D(sale['unit_price']) + D(sale['freight_per_unit']))
        receipts = sum(D(r['amount']) for r in f['receipts'])
        effective = sum(D(r['amount']) for r in f['receipts'] if r['affects_balance'])
        expenses = sum(D(r['amount_afn']) for r in f['expenses'])
        salaries = sum(D(r['amount_afn']) for r in f['salaries'])
        cash_exp = sum(D(r['amount_afn']) for r in f['expenses'] if r['payment']=='cash' and r['payer_kind']=='cashbox')
        cash_sal = sum(D(r['amount_afn']) for r in f['salaries'] if r['payment']=='cash' and r['payer_kind']=='cashbox')
        results = {
            'credit_sale_total': total,
            'customer_balance': D(f['opening_customer_debt']) + total - effective,
            'legacy_ledger_if_both_receipts_within_range': D(f['opening_customer_debt']) + total - receipts,
            'legacy_simple_cash_delta': D(f['cash_sale']) + receipts - expenses - salaries,
            'legacy_cash_only_delta': D(f['cash_sale']) + receipts - cash_exp - cash_sal,
            'legacy_profit_formula': total + D(f['cash_sale']) - expenses - salaries,
        }
        self.assertEqual(results, {key:D(value) for key,value in f['expected'].items()})

if __name__ == '__main__': unittest.main()
