import pytest
from sync_inventario_fisico import parse_rows, build_apply_sql, build_preview_sql

# Cada fila imita la hoja "Data": (n_240, ubic_240, n_1100, ubic_1100), None = celda vacía.

def test_tacho_con_y_sin_llantas():
    items, skipped = parse_rows([
        (1, 'Con llantas limpios', None, None),
        (2, 'Sin llantas y en proceso', None, None),
    ])
    assert items == [('001', True, None), ('002', False, None)]
    assert skipped == []

def test_numero_con_texto_pegado():
    items, _ = parse_rows([('192 ION', 'Con llantas limpios', None, None)])
    assert items == [('192', True, None)]

def test_yaris_por_color():
    items, _ = parse_rows([
        (None, None, 1, 'Limpios rojos'),
        (None, None, 6, 'En Proceso rojos'),
    ])
    assert items == [('Y1', None, 'rojo'), ('Y6', None, 'rojo')]

def test_fila_sin_numero_se_informa_y_no_se_carga():
    items, skipped = parse_rows([(None, None, None, 'Limpios Verde')])
    assert items == []
    assert skipped == ['1100 L sin número: "Limpios Verde"']

def test_ubicacion_desconocida_falla_con_la_fila():
    with pytest.raises(ValueError, match='fila 1.*Con Llantas Limpio'):
        parse_rows([(3, 'Con Llantas Limpio', None, None)])

def test_apply_solo_toca_has_wheels_y_color():
    sql = build_apply_sql([('001', True, None), ('Y1', None, 'rojo')])
    assert 'has_wheels' in sql and 'color' in sql
    assert 'status' not in sql and 'tare_weight_kg' not in sql
    assert "('001', true, null)" in sql
    assert "('Y1', null, 'rojo')" in sql

def test_preview_no_modifica():
    sql = build_preview_sql([('001', True, None)]).lower()
    assert sql.lstrip().startswith('with') or sql.lstrip().startswith('select')
    assert 'update' not in sql
