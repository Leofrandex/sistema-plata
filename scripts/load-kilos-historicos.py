#!/usr/bin/env python
"""
Carga scripts/out/historical-daily-kg.json en public.historical_daily_kg.

Empuja por PostgREST con la publishable key de `.env.local`. La tabla solo
acepta escritura de coordinador, asi que la carga necesita una politica de
insercion temporal abierta -- se crea antes y se borra despues, desde el lado
de Supabase, no desde aca.

Uso:
    python scripts/extract-kilos-historicos.py
    python scripts/load-kilos-historicos.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(REPO, "scripts", "out", "historical-daily-kg.json")
BATCH = 500


def env(nombre: str) -> str:
    for candidato in (".env.local", os.path.join("hub", ".env.local")):
        path = os.path.join(REPO, candidato)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            for linea in fh:
                linea = linea.strip()
                if linea.startswith(f"{nombre}="):
                    return linea.split("=", 1)[1].strip()
    print(f"No encontre {nombre} en .env.local", file=sys.stderr)
    raise SystemExit(1)


def main() -> int:
    url = env("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
    key = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")

    with open(JSON_PATH, encoding="utf-8") as fh:
        filas = json.load(fh)
    print(f"{len(filas)} filas para cargar")

    endpoint = f"{url}/rest/v1/historical_daily_kg"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    cargadas = 0
    for i in range(0, len(filas), BATCH):
        lote = filas[i : i + BATCH]
        req = urllib.request.Request(
            endpoint,
            data=json.dumps(lote).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req) as resp:
                if resp.status >= 300:
                    print(f"HTTP {resp.status} en el lote {i}", file=sys.stderr)
                    return 1
        except urllib.error.HTTPError as err:
            print(f"HTTP {err.code} en el lote {i}: {err.read().decode()[:500]}", file=sys.stderr)
            return 1
        cargadas += len(lote)
        print(f"  {cargadas}/{len(filas)}")

    print("Listo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
