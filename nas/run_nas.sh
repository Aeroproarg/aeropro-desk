#!/bin/sh
# Script completo para la tarea existente, usuario aeropro, cada cinco minutos.
set -u
DIRECTORIO="/volume1/@aeropro-desk"
PYTHON="$(cat "$DIRECTORIO/python_path.txt")" || exit 1
"$PYTHON" "$DIRECTORIO/aeropro_prepare_folders.py" > /volume1/Backup/_aeropro_desk_preparacion.txt 2>&1
PREPARACION=$?
"$PYTHON" "$DIRECTORIO/aeropro_nas.py" > /volume1/Backup/_aeropro_desk_new.txt 2>&1
DETECCION=$?
if [ "$PREPARACION" -ne 0 ] || [ "$DETECCION" -ne 0 ]; then exit 1; fi
