#!/usr/bin/env python3
"""Procesa solicitudes de AeroPro Desk. No borra, renombra ni mueve material.
Ejecutar con el mismo usuario del detector. Requiere el detector actualizado.
"""
import contextlib
import json
import os
from pathlib import Path
import re
import ssl
import stat
import sys
import time
import urllib.request
import uuid

from aeropro_nas import BACKUP, CONTROL, NoRedirect

URL = 'https://aeroprodesk.netlify.app/api/nas/folders'
ROOT_PATTERN = re.compile(r'^\d{8}-\d{2,}_[A-Z0-9_]{1,55}$')
CHILD_PATTERN = re.compile(r'^\d{3}_[A-Z0-9_]{1,111}$')
MARKER = '.aeropro-production.json'


def validate(plan):
    if not isinstance(plan, dict):
        raise ValueError('Solicitud invalida')
    for key in ('id', 'production_id'):
        if str(uuid.UUID(plan[key])) != plan[key]:
            raise ValueError('Identificador invalido')
    if type(plan['revision']) is not int or plan['revision'] < 1:
        raise ValueError('Revision invalida')
    if not isinstance(plan['root_name'], str) or not ROOT_PATTERN.fullmatch(plan['root_name']):
        raise ValueError('Carpeta principal invalida')
    entries = plan['entries']
    if not isinstance(entries, list) or not 1 <= len(entries) <= 100:
        raise ValueError('Cantidad de equipos invalida')
    names, ids = set(), set()
    for entry in entries:
        name = entry['folderName']
        if not isinstance(name, str) or not CHILD_PATTERN.fullmatch(name) or name in names:
            raise ValueError('Subcarpeta invalida o repetida')
        equipment_id = str(uuid.UUID(entry['equipmentId']))
        if equipment_id in ids:
            raise ValueError('Equipo repetido')
        names.add(name)
        ids.add(equipment_id)
    return plan


@contextlib.contextmanager
def open_directory(name, parent=None):
    # O_NOFOLLOW + dir_fd evita atravesar enlaces aun si cambian durante la operacion.
    fd = os.open(str(name), os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
    try:
        yield fd
    finally:
        os.close(fd)


def create_directories(plan):
    validate(plan)
    expected = {'planId': plan['id'], 'productionId': plan['production_id']}
    with open_directory(BACKUP) as backup_fd:
        new = False
        try:
            os.mkdir(plan['root_name'], mode=0o770, dir_fd=backup_fd)
            new = True
            os.fsync(backup_fd)
        except FileExistsError:
            pass
        with open_directory(plan['root_name'], backup_fd) as root_fd:
            if new:
                fd = os.open(MARKER, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                             0o660, dir_fd=root_fd)
                with os.fdopen(fd, 'w', encoding='utf-8') as out:
                    json.dump(expected, out)
                    out.flush()
                    os.fsync(out.fileno())
                os.fsync(root_fd)
            else:
                # No adoptar una carpeta ajena, aunque coincida el nombre.
                fd = os.open(MARKER, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=root_fd)
                with os.fdopen(fd, 'r', encoding='utf-8') as source:
                    if not stat.S_ISREG(os.fstat(source.fileno()).st_mode) or json.loads(source.read(4096)) != expected:
                        raise ValueError('La carpeta existente pertenece a otra produccion')
            for entry in plan['entries']:
                try:
                    os.mkdir(entry['folderName'], mode=0o770, dir_fd=root_fd)
                except FileExistsError:
                    pass
                with open_directory(entry['folderName'], root_fd):
                    pass
            os.fsync(root_fd)


def exchange(opener, token, body=None):
    request = urllib.request.Request(URL,
        data=None if body is None else json.dumps(body).encode('utf-8'),
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
        method='GET' if body is None else 'POST')
    with opener.open(request, timeout=20) as response:
        raw = response.read(1024 * 1024 + 1)
        if response.status != 200 or len(raw) > 1024 * 1024:
            raise ValueError('Respuesta invalida')
        return json.loads(raw)


def process(plans, create, acknowledge, deadline):
    if not isinstance(plans, list) or len(plans) > 20:
        raise ValueError('Listado invalido')
    for plan in plans:
        if time.monotonic() >= deadline:
            break
        validate(plan)
        state = 'READY'
        try:
            create(plan)
        except (OSError, ValueError, KeyError, TypeError):
            state = 'ERROR'
        # Si falla el acuse, la solicitud sigue pendiente y se reintenta idempotentemente.
        answer = acknowledge({'id': plan['id'], 'revision': plan['revision'], 'state': state})
        if not isinstance(answer, dict) or answer.get('ok') is not True:
            raise ValueError('Confirmacion invalida')
        print('Preparacion de carpeta: ' + state, flush=True)


def main():
    import fcntl
    os.umask(0o007)  # Permite acceso al grupo; conserva las ACL heredadas de Backup.
    info = CONTROL.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077:
        raise ValueError('Configuracion privada invalida')
    with (CONTROL / 'run.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Otra tarea del NAS esta en curso. Se reintentara.')
            return
        secret = CONTROL / 'nas_token.txt'
        info = secret.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077:
            raise ValueError('Token sin permisos privados')
        token = secret.read_text(encoding='ascii').strip()
        if not token or any(ord(c) < 33 or ord(c) > 126 for c in token):
            raise ValueError('Token invalido')
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect(),
                    urllib.request.HTTPSHandler(context=ssl.create_default_context()))
        response = exchange(opener, token)
        process(response['plans'], create_directories,
                lambda body: exchange(opener, token, body), time.monotonic() + 180)
        print('Revision de carpetas finalizada.')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('Preparacion pendiente. Tipo de error: ' + type(exc).__name__)
        sys.exit(1)
