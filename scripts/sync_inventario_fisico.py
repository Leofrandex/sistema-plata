#!/usr/bin/env python3
"""
Sincroniza has_wheels y color de public.containers con el Excel de inventario
de planta ("Inventario de Contenedores en Proceso", hoja "Data").

Uso:
    python scripts/sync_inventario_fisico.py "<excel>"            > preview.sql
    python scripts/sync_inventario_fisico.py "<excel>" --apply    > apply.sql
    # Correr el SQL con MCP execute_sql sobre el piloto (xqqnthyipkdkwyknbtnw).

- Por defecto genera un SELECT de vista previa: qué cambiaría y qué
  contenedores activos no están en el Excel. No modifica nada.
- --apply genera el UPDATE. Solo escribe has_wheels y color; nunca status ni tara.
- La columna "limpio / en proceso" del Excel se ignora: ese estado se deriva
  en vivo de los eventos (ver docs/superpowers/specs/2026-09-24-inventario-fisico-dashboard-design.md).
- Filas sin número (p. ej. Yaris verdes sin numerar) se informan por stderr y no se cargan.
"""
from __future__ import annotations
import re
import sys
from typing import Iterable, Optional

Item = tuple[str, Optional[bool], Optional[str]]

WHEELS = {
    'con llantas limpios': True,
    'con llantas y en proceso': True,
    'sin llantas limpios': False,
    'sin llantas y en proceso': False,
}
COLORS = {
    'limpios rojos': 'rojo',
    'en proceso rojos': 'rojo',
    'limpios verde': 'verde',
    'en proceso verde': 'verde',
}


def _number(cell) -> Optional[int]:
    if cell is None:
        return None
    m = re.match(r'\s*(\d+)', str(cell))
    return int(m.group(1)) if m else None


def _lookup(table: dict, text: str, fila: int):
    key = ' '.join(str(text).split()).lower()
    if key not in table:
        raise ValueError(f'fila {fila}: ubicación desconocida "{text}"')
    return table[key]


def parse_rows(rows: Iterable[tuple]) -> tuple[list[Item], list[str]]:
    """rows: (n_240, ubic_240, n_1100, ubic_1100) por fila de datos, 1-indexadas."""
    items: list[Item] = []
    skipped: list[str] = []
    for fila, (n240, u240, n1100, u1100) in enumerate(rows, start=1):
        if u240 is not None:
            wheels = _lookup(WHEELS, u240, fila)
            n = _number(n240)
            if n is None:
                skipped.append(f'240 L sin número: "{u240}"')
            else:
                items.append((str(n).zfill(3), wheels, None))
        if u1100 is not None:
            color = _lookup(COLORS, u1100, fila)
            n = _number(n1100)
            if n is None:
                skipped.append(f'1100 L sin número: "{u1100}"')
            else:
                items.append((f'Y{n}', None, color))
    return items, skipped


def _sql_bool(v: Optional[bool]) -> str:
    return 'null' if v is None else ('true' if v else 'false')


def _sql_text(v: Optional[str]) -> str:
    return 'null' if v is None else f"'{v}'"


def _values(items: list[Item]) -> str:
    return ',\n  '.join(f"('{cid}', {_sql_bool(w)}, {_sql_text(c)})" for cid, w, c in items)


def build_preview_sql(items: list[Item]) -> str:
    return f"""with t(id, has_wheels, color) as (values
  {_values(items)}
)
select 'cambia' as tipo, c.id, c.has_wheels as antes_llantas, t.has_wheels as despues_llantas,
       c.color as antes_color, t.color as despues_color
from public.containers c join t on t.id = c.id
where (t.has_wheels is not null and c.has_wheels is distinct from t.has_wheels)
   or (t.color is not null and c.color is distinct from t.color)
union all
select 'no existe en sistema', t.id, null, t.has_wheels, null, t.color
from t left join public.containers c on c.id = t.id where c.id is null
union all
select 'activo sin fila en excel', c.id, c.has_wheels, null, c.color, null
from public.containers c
where c.status = 'active' and (c.size_liters = '240' or c.is_yaris_container)
  and not c.is_metallic_dedicated and c.id not in (select id from t)
order by 1, 2;"""


def build_apply_sql(items: list[Item]) -> str:
    return f"""with t(id, has_wheels, color) as (values
  {_values(items)}
)
update public.containers c
set has_wheels = coalesce(t.has_wheels, c.has_wheels),
    color      = coalesce(t.color, c.color)
from t
where c.id = t.id
  and ((t.has_wheels is not null and c.has_wheels is distinct from t.has_wheels)
    or (t.color is not null and c.color is distinct from t.color))
returning c.id, c.has_wheels, c.color;"""


def read_excel(path: str) -> list[tuple]:
    import openpyxl
    ws = openpyxl.load_workbook(path, data_only=True)['Data']
    out = []
    for r in ws.iter_rows(min_row=5, values_only=True):
        n240, u240, n1100, u1100 = r[2], r[3], r[6], r[7]
        if u240 is None and u1100 is None:
            continue
        out.append((n240, u240, n1100, u1100))
    return out


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    items, skipped = parse_rows(read_excel(argv[1]))
    print(f'{len(items)} contenedores leídos; {len(skipped)} filas sin número:', file=sys.stderr)
    for s in skipped:
        print(f'  - {s}', file=sys.stderr)
    print(build_apply_sql(items) if '--apply' in argv else build_preview_sql(items))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
