"""Build a private host archive, with a consistent SQLite snapshot and no credentials."""
from pathlib import Path
import argparse
import sqlite3
import tempfile
import zipfile
from contextlib import closing

ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--host',choices=('squarecloud','discloud'),default='squarecloud')
args=parser.parse_args()
files=['main.py','dashboard.py','server.py','server_ui.py','store.py','bridge.py','catalog.json','requirements.txt','requirements.lock','.env.example']
files+=['squarecloud.app' if args.host=='squarecloud' else 'discloud.config']
files+=[str(path.relative_to(ROOT)) for path in (ROOT/'assets').iterdir() if path.suffix in ('.png','.gif')]
output=ROOT/'.data'/('worldforge-'+args.host+'.zip');output.parent.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as temp:
    snapshot=Path(temp)/'settings.sqlite3'
    database=ROOT/'.data'/'settings.sqlite3'
    if database.exists():
        with closing(sqlite3.connect(database.as_uri()+'?mode=ro',uri=True)) as source,closing(sqlite3.connect(snapshot)) as destination:
            source.backup(destination)
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
        for name in files: archive.write(ROOT/name,name.replace('\\','/'))
        if snapshot.exists(): archive.write(snapshot,'.data/settings.sqlite3')
print(f'Pacote privado preparado: {output.name}. Não contém .env nem chaves. Configure os segredos na hospedagem antes de iniciar.')
