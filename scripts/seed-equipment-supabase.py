#!/usr/bin/env python3
"""
Genera el SQL de seed de equipos (base instalada PTDP) para Supabase.

Lee el Excel del inbox e imprime un INSERT en stdout. La columna
"COMENTARIOS" del Excel es en realidad el dueño (CSS/HOSPIMED/HOSPIWASTE)
→ va a equipment.owner. maintenance_frequency_days queda NULL (se
configura en la app).

Idempotente a nivel tabla: solo inserta si equipment está vacía.

Uso:
    python scripts/seed-equipment-supabase.py > seed-equipment.sql
    # Aplicar vía MCP execute_sql o SQL editor de Supabase.
"""
from __future__ import annotations
from pathlib import Path
import openpyxl

XLSX = (
    Path(__file__).resolve().parent.parent
    / "vault" / "inbox" / "BASE INSTALADA PTDP HOSPIMED ST SOFTWARE.xlsx"
)

COLS = ["name", "brand", "model", "serial", "identification", "owner", "provider"]


def clean(value) -> str | None:
    """Normaliza celdas: números → str, strips de espacios, vacío → None."""
    if value is None:
        return None
    text = " ".join(str(value).split())  # colapsa espacios internos y bordes
    return text or None


def sql_literal(value: str | None) -> str:
    if value is None:
        return "null"
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["Hoja1"]
    rows = []
    for row in ws.iter_rows(min_row=4, min_col=2, max_col=8, values_only=True):
        values = [clean(v) for v in row]
        if values[0] is None:  # fila sin nombre de equipo → ignorar
            continue
        rows.append("(" + ", ".join(sql_literal(v) for v in values) + ")")

    print(f"-- Seed de {len(rows)} equipos (base instalada PTDP)")
    print("insert into public.equipment")
    print("  (name, brand, model, serial, identification, owner, provider)")
    print("select * from (values")
    print(",\n".join(rows))
    print(f") as v({', '.join(COLS)})")
    print("where not exists (select 1 from public.equipment);")


if __name__ == "__main__":
    main()
