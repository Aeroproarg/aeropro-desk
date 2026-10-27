#!/usr/bin/env python3
"""AeroPro Desk: ejecutar cada 5 minutos con Python 3 (Linux/Synology).

Instalacion guiada: guardar este archivo y nas_token.txt en
/volume1/@aeropro-desk (directorio 700, archivos 600, mismo usuario de la tarea).
nas_token.txt contiene solamente el valor de NAS_INGEST_TOKEN.
Reemplazar la tarea anterior; no ejecutar ambos detectores simultaneamente.
No mueve ni borra material. Solo escribe sus archivos de control.
"""
import datetime
import json
import os
import re
from pathlib import Path
import sqlite3
import ssl
import stat
import sys
import time
import urllib.error
import urllib.request

BACKUP = Path('/volume1/Backup')
CONTROL = Path('/volume1/@aeropro-desk')
URL = 'https://aeroprodesk.netlify.app/api/nas/detections'
EXCLUDED = {'#recycle', '@eaDir', '@tmp', '@eaStream', '#snapshot'}


def scan(root):
    result = set()
    def visit(parent, depth):
        with os.scandir(str(parent)) as entries:
            for entry in entries:
                if entry.name in EXCLUDED or not entry.is_dir(follow_symlinks=False):
                    continue
                path = Path(entry.path)
                # Espacio reservado para producciones preparadas por AeroPro Desk.
                # No interpretar carpetas vacias ni subcarpetas como backups terminados.
                # Se excluye incluso antes de escribir el marcador para evitar carreras.
                if depth == 0 and re.fullmatch(r'\d{8}-\d{2,}_[A-Z0-9_]{1,55}', entry.name):
                    continue
                # El endpoint recorta espacios; evitar colisiones silenciosas.
                if '\n' in str(path) or '\r' in str(path) or str(path) != str(path).strip():
                    raise ValueError('Nombre incompatible con el historial o el endpoint')
                level = depth + 1
                if level >= 2:
                    result.add(str(path))
                if level < 4:
                    visit(path, level)
    visit(root, 0)
    return result


def payload(path, root):
    parts = Path(path).relative_to(root).parts
    date = None
    try:
        date = datetime.datetime.strptime(parts[0], '%Y-%m-%d').date().isoformat()
    except ValueError:
        pass
    return {'nasPath': '/Backup/' + '/'.join(parts), 'backupDate': date,
            'detectedProjectName': parts[1], 'materialName': parts[-1]}


def connect(path):
    db = sqlite3.connect(str(path))
    db.execute('PRAGMA synchronous=FULL')
    db.execute('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY)')
    db.execute('CREATE TABLE IF NOT EXISTS folders '
               '(path TEXT PRIMARY KEY, body TEXT, sent INTEGER NOT NULL, logged INTEGER NOT NULL)')
    db.commit()
    return db


def enqueue(db, current, legacy, root):
    with db:
        if not db.execute("SELECT 1 FROM meta WHERE key='initialized'").fetchone():
            # Si no hay historial, lo existente se toma como punto de partida.
            baseline = set(legacy.read_text(encoding='utf-8').splitlines()) if legacy.exists() else current
            if any(not p.startswith(str(root) + os.sep) for p in baseline):
                raise ValueError('Historial anterior incompatible; no se modifico')
            db.executemany('INSERT OR IGNORE INTO folders VALUES (?, NULL, 1, 1)',
                           [(p,) for p in baseline])
            db.execute("INSERT INTO meta VALUES ('initialized')")
        for path in sorted(current):
            body = json.dumps(payload(path, root), ensure_ascii=True)
            db.execute('INSERT OR IGNORE INTO folders VALUES (?, ?, 0, 0)', (path, body))


def sync_history(db, seen, events):
    # Append solamente: nunca reemplaza el historial anterior.
    known = set(seen.read_text(encoding='utf-8').splitlines()) if seen.exists() else set()
    with seen.open('a', encoding='utf-8') as out:
        for (path,) in db.execute('SELECT path FROM folders ORDER BY path'):
            if path not in known:
                out.write(path + '\n')
        out.flush()
        os.fsync(out.fileno())
    for path, in db.execute('SELECT path FROM folders WHERE logged=0').fetchall():
        with events.open('a', encoding='utf-8') as out:
            out.write('\nDETECCION: ' + datetime.datetime.now().isoformat() + '\n' + path + '\n')
            out.flush()
            os.fsync(out.fileno())
        with db:
            db.execute('UPDATE folders SET logged=1 WHERE path=?', (path,))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def send(db, token, opener, deadline):
    failed = False
    for path, body in db.execute('SELECT path, body FROM folders WHERE sent=0 ORDER BY path').fetchall():
        if time.monotonic() >= deadline:
            break
        request = urllib.request.Request(URL, data=body.encode('utf-8'), method='POST',
            headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
        try:
            with opener.open(request, timeout=20) as response:
                answer = json.loads(response.read(1024 * 1024))
                expected = json.loads(body)['nasPath']
                if (response.status not in (200, 201) or answer.get('ok') is not True
                        or answer.get('detection', {}).get('nas_path') != expected):
                    raise ValueError('Respuesta sin confirmacion valida')
        except urllib.error.HTTPError as exc:
            print('Envio pendiente: HTTP ' + str(exc.code), flush=True)
            failed = True
            break
        except (OSError, ValueError, TypeError, AttributeError):
            print('Envio pendiente: red, certificado o respuesta no valida.', flush=True)
            failed = True
            break
        with db:
            db.execute('UPDATE folders SET sent=1 WHERE path=?', (path,))
    pending = db.execute('SELECT count(*) FROM folders WHERE sent=0').fetchone()[0]
    print('Revision terminada. Envios pendientes: ' + str(pending), flush=True)
    return 1 if failed else 0


def main():
    import fcntl
    os.umask(0o077)
    if not BACKUP.is_dir() or not CONTROL.is_dir():
        raise ValueError('Falta Backup o el directorio privado de configuracion')
    info = CONTROL.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077:
        raise ValueError('El directorio privado debe pertenecer al usuario de la tarea y tener permiso 700')
    with (CONTROL / 'run.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Ya hay una revision en curso.')
            return 0
        secret = CONTROL / 'nas_token.txt'
        info = secret.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077:
            raise ValueError('El token debe ser un archivo privado del usuario de la tarea (600)')
        token = secret.read_text(encoding='ascii').strip()
        if not token or any(ord(c) < 33 or ord(c) > 126 for c in token):
            raise ValueError('Token vacio o con caracteres invalidos')
        seen = BACKUP / '_aeropro_desk_seen.txt'
        events = BACKUP / '_aeropro_desk_events.txt'
        if seen.is_symlink() or events.is_symlink():
            raise ValueError('Los archivos de historial no pueden ser enlaces')
        # Un escaneo incompleto aborta antes de alterar el estado.
        current = scan(BACKUP)
        db = connect(CONTROL / 'queue.sqlite3')
        try:
            enqueue(db, current, seen, BACKUP)
            sync_history(db, seen, events)
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect(),
                urllib.request.HTTPSHandler(context=ssl.create_default_context()))
            return send(db, token, opener, time.monotonic() + 200)
        finally:
            db.close()


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        # No imprimir cabeceras, token ni respuestas remotas.
        print('Revision detenida sin descartar pendientes. Tipo de error: ' + type(exc).__name__)
        sys.exit(1)
