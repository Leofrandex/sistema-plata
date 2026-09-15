#!/usr/bin/env python
"""
Excel de kilos diarios (PTDP) -> agregado diario para `historical_daily_kg`.

Dos libros, mismo esquema, sin solapamiento entre ellos:
  - F-PR-PT- 13. Kilos diarios.xlsx   2024-01-15 -> 2025-12-31
  - Kilos diarios-HW.xlsx             2026-01-01 -> 2026-09-06

El sistema en vivo es dueno de 2026-09-07 en adelante; este script corta ahi.

Se agrega por (fecha, empresa) en vez de importar los ~70k pesajes individuales:
el detalle por pesaje no es trazable (no tiene operador, foto ni sesion) y todo
lo que consumen el dashboard y los reportes -- totales, promedios, tendencias,
comparativos ano contra ano -- sale exacto del agregado diario porque guardamos
suma Y conteo. La fuente de verdad por registro sigue siendo el Excel en
`docs/fuentes/`; este script es determinista y lo regenera cuando haga falta.

Uso:
    python scripts/extract-kilos-historicos.py [--out DIR]
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import os
import re
import sys
import unicodedata
import warnings

import openpyxl

warnings.filterwarnings("ignore")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTES = os.path.join(REPO, "docs", "fuentes")

# El sistema en vivo arranca este dia; el historico no lo toca.
CORTE = dt.date(2026, 9, 7)

# La planta arranco en enero 2024. Cualquier fecha anterior es un tipeo del
# operario -- en `Fecha de Tratado` hay cuatro (2002, 2005, 2012 x2).
ORIGEN = dt.date(2024, 1, 1)

# Libro -> codigo corto que se guarda en la columna `source`.
LIBROS = {
    "F-PR-PT- 13. Kilos diarios.xlsx": "F-PR-PT-13",
    "Kilos diarios-HW.xlsx": "HW",
}

# Columnas de la hoja `Kilos Diarios` (fila 2 es el header, los datos arrancan en la 3).
EMPRESA, CARRO, FECHA, HORA, TARA, PESO, NETO, OBS, TRATADO, NEVERA = range(10)

# Empresa normalizada -> company_id de Supabase (None = no existe en el sistema).
COMPANIES = {
    "airkem": ("Airkem", "company-airkem"),
    "ion - airkem": ("ION - Airkem", None),
    "ion-airkem": ("ION - Airkem", None),
    "airkem-ion": ("ION - Airkem", None),
    "ion": ("ION", "company-ion"),
    "sicarelle": ("Sicarelle", None),
    "handy solutions": ("Handy Solutions", None),
    "handy solution": ("Handy Solutions", None),
    "jcv": ("JCV", None),
}

SIN_EMPRESA = ("Sin especificar", None)

# Valores que el operario escribio en la columna Empresa pero son tipo de
# desecho, no empresa. Se cuentan aparte para no inventar una empresa falsa.
TIPOS_DE_DESECHO = {"metalicos no reutilizables", "anatomopatologico"}


def slug(value: object) -> str:
    """Minusculas, sin acentos, sin espacios de mas."""
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text)


def normalizar_empresa(raw: object) -> tuple[str, str | None]:
    key = slug(raw)
    if not key:
        return SIN_EMPRESA
    if key in COMPANIES:
        return COMPANIES[key]
    if key in TIPOS_DE_DESECHO:
        return SIN_EMPRESA
    # Desconocida: se respeta tal cual vino, con la primera letra en mayuscula.
    return (str(raw).strip(), None)


def fecha_de(value: object) -> dt.date | None:
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    return None


def numero(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


def leer(path: str) -> list[tuple]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["Kilos Diarios"]
    filas = []
    for row in ws.iter_rows(min_row=3, max_col=10, values_only=True):
        if row[FECHA] is None and row[PESO] is None and row[NETO] is None:
            continue
        filas.append(row)
    wb.close()
    return filas


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(REPO, "scripts", "out"))
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    # (fecha, empresa) -> medidas
    recibido: dict[tuple[dt.date, str], dict] = {}
    tratado: dict[tuple[dt.date, str], dict] = {}
    company_ids: dict[str, str | None] = {}

    descartes = collections.Counter()
    fuente_de: dict[tuple[dt.date, str], set[str]] = collections.defaultdict(set)

    # Control: suma cruda de la columna `Peso menos la Tara` tal cual la lee la
    # tabla dinamica del Excel, sin limpiar nada. Sirve para probar que estamos
    # leyendo el mismo universo de filas que el libro de origen.
    crudo_por_ano: collections.Counter = collections.Counter()
    # Cobertura de `Fecha de Tratado`: es opcional en el formulario de planta.
    trat_con = collections.Counter()
    trat_sin = collections.Counter()

    for libro, codigo in LIBROS.items():
        path = os.path.join(FUENTES, libro)
        if not os.path.exists(path):
            print(f"FALTA el libro: {path}", file=sys.stderr)
            return 1
        filas = leer(path)
        print(f"{libro}: {len(filas)} filas con datos")

        for row in filas:
            fecha = fecha_de(row[FECHA])
            if fecha is None:
                descartes["sin fecha"] += 1
                continue
            if fecha >= CORTE:
                descartes["posterior al corte"] += 1
                continue

            crudo = numero(row[NETO])
            if crudo is not None:
                crudo_por_ano[fecha.year] += crudo

            neto = numero(row[NETO])
            if neto is None:
                bruto, tara = numero(row[PESO]), numero(row[TARA])
                neto = bruto - tara if bruto is not None and tara is not None else None
            if neto is None:
                descartes["sin peso neto"] += 1
                continue
            if neto <= 0:
                descartes["peso neto <= 0"] += 1
                continue

            nombre, cid = normalizar_empresa(row[EMPRESA])
            company_ids[nombre] = cid
            carro = str(row[CARRO]).strip() if row[CARRO] else None

            key = (fecha, nombre)
            acc = recibido.setdefault(key, {"kg": 0.0, "n": 0, "carros": set()})
            acc["kg"] += neto
            acc["n"] += 1
            if carro:
                acc["carros"].add(carro)
            fuente_de[key].add(codigo)

            ftrat = fecha_de(row[TRATADO])
            if ftrat is not None and not (ORIGEN <= ftrat < CORTE):
                descartes["fecha de tratado fuera de rango"] += 1
                ftrat = None
            if ftrat is None:
                trat_sin[fecha.year] += 1
            else:
                trat_con[fecha.year] += 1
                tacc = tratado.setdefault((ftrat, nombre), {"kg": 0.0, "n": 0})
                tacc["kg"] += neto
                tacc["n"] += 1
                company_ids.setdefault(nombre, cid)

    claves = sorted(set(recibido) | set(tratado))
    registros = []
    for fecha, nombre in claves:
        r = recibido.get((fecha, nombre), {"kg": 0.0, "n": 0, "carros": set()})
        t = tratado.get((fecha, nombre), {"kg": 0.0, "n": 0})
        registros.append(
            {
                "weighed_on": fecha.isoformat(),
                "company_name": nombre,
                "company_id": company_ids.get(nombre),
                "received_kg": round(r["kg"], 2),
                "received_records": r["n"],
                "received_carts": len(r["carros"]),
                "treated_kg": round(t["kg"], 2),
                "treated_records": t["n"],
                # Vacio = la fila existe solo porque algo se trato ese dia,
                # sin pesajes recibidos.
                "source": "+".join(sorted(fuente_de.get((fecha, nombre), {"tratado"}))),
            }
        )

    # ---- validacion -------------------------------------------------------
    por_ano = collections.Counter()
    regs_por_ano = collections.Counter()
    for r in registros:
        ano = r["weighed_on"][:4]
        por_ano[ano] += r["received_kg"]
        regs_por_ano[ano] += r["received_records"]

    print("\nAgregado diario:", len(registros), "filas (fecha x empresa)")
    print("Rango:", registros[0]["weighed_on"], "->", registros[-1]["weighed_on"])
    for ano in sorted(por_ano):
        print(f"  {ano}: {regs_por_ano[ano]:>7} pesajes  {por_ano[ano]:>12,.2f} kg")
    print("  TOTAL:", f"{sum(por_ano.values()):,.2f} kg")
    print("\nDescartes:", dict(descartes) or "ninguno")
    print("Empresas:", {k: v for k, v in sorted(company_ids.items())})

    print("\nCobertura de `Fecha de Tratado` (es opcional en el formulario):")
    for ano in sorted(set(trat_con) | set(trat_sin)):
        con, sin = trat_con[ano], trat_sin[ano]
        pct = 100 * con / (con + sin) if con + sin else 0
        print(f"  {ano}: {con:>6} con fecha / {con + sin:>6} pesajes  ({pct:.1f}%)")

    # Contraste contra la tabla dinamica del propio Excel (hoja "Resumen ").
    # Se compara la suma CRUDA de la columna, que es lo que suma esa dinamica;
    # `received_kg` difiere a proposito porque descarta netos <= 0 y recalcula
    # bruto - tara donde la columna quedo vacia.
    esperado = {2024: 216122.79, 2025: 499651.24}
    print("\nControl contra la tabla dinamica del Excel (hoja 'Resumen '):")
    ok = True
    for ano, ref in esperado.items():
        got = crudo_por_ano.get(ano, 0.0)
        bien = abs(got - ref) < 0.5
        ok = ok and bien
        print(f"  {ano}: crudo {got:,.2f} vs {ref:,.2f} -> {'OK' if bien else 'DIFIERE'}")
        limpio = por_ano.get(str(ano), 0.0)
        print(f"        limpio {limpio:,.2f}  (delta {limpio - got:+,.2f} por la limpieza)")
    if not ok:
        print("\nERROR: la lectura no reproduce los totales del Excel.", file=sys.stderr)
        return 1

    # ---- salidas ----------------------------------------------------------
    json_path = os.path.join(args.out, "historical-daily-kg.json")
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(registros, fh, ensure_ascii=False, indent=1)

    sql_path = os.path.join(args.out, "historical-daily-kg.sql")
    with open(sql_path, "w", encoding="utf-8") as fh:
        fh.write("-- Generado por scripts/extract-kilos-historicos.py. No editar a mano.\n")
        fh.write("begin;\ntruncate table public.historical_daily_kg;\n")
        cols = (
            "weighed_on, company_name, company_id, received_kg, received_records, "
            "received_carts, treated_kg, treated_records, source"
        )
        BATCH = 500
        for i in range(0, len(registros), BATCH):
            lote = registros[i : i + BATCH]
            fh.write(f"insert into public.historical_daily_kg ({cols}) values\n")
            valores = []
            for r in lote:
                cid = f"'{r['company_id']}'" if r["company_id"] else "null"
                nombre = r["company_name"].replace("'", "''")
                src = r["source"].replace("'", "''")
                valores.append(
                    f"('{r['weighed_on']}','{nombre}',{cid},{r['received_kg']},"
                    f"{r['received_records']},{r['received_carts']},"
                    f"{r['treated_kg']},{r['treated_records']},'{src}')"
                )
            fh.write(",\n".join(valores) + ";\n")
        fh.write("commit;\n")

    print(f"\nEscrito: {json_path}")
    print(f"Escrito: {sql_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
