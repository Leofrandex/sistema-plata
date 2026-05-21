#!/usr/bin/env python3
"""
Genera el SQL de seed de envases para Supabase.

Lee `src/lib/data/historical-data.json` (extraído del Excel del cliente)
e imprime un INSERT idempotente en stdout.

Uso:
    python scripts/seed-containers-supabase.py > /tmp/seed.sql
    # Luego pegarlo en Supabase SQL editor o ejecutar vía MCP execute_sql.

Notas:
- company_id queda NULL — piloto 2026-05-21, los envases son comunes.
- on conflict (id) do nothing → re-ejecutable sin riesgo.
"""
from __future__ import annotations
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "src" / "lib" / "data" / "historical-data.json"


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    rows = [
        f"('{c['id']}', '{c['size_liters']}', {c['tare_weight_kg']}, "
        f"'{c['waste_type']}', 'active', '{c['registered_at']}')"
        for c in data["containers"]
    ]
    print(
        "insert into public.containers "
        "(id, size_liters, tare_weight_kg, waste_type, status, registered_at) values"
    )
    print(",\n".join(rows))
    print("on conflict (id) do nothing;")


if __name__ == "__main__":
    main()
