"""Prepara .env e uma chave de integração sem imprimir credenciais."""
import hashlib
import secrets
from pathlib import Path
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parent
env_path = ROOT / '.env'
if not env_path.exists():
    env_path.write_text((ROOT / '.env.example').read_text(encoding='utf-8'), encoding='utf-8')
values = dotenv_values(env_path)
token = values.get('WORLDFORGE_BRIDGE_TOKEN')
if not token:
    token = 'wfbot_' + secrets.token_urlsafe(32)
    content = env_path.read_text(encoding='utf-8')
    content = content.replace('WORLDFORGE_BRIDGE_TOKEN=', 'WORLDFORGE_BRIDGE_TOKEN=' + token, 1)
    env_path.write_text(content, encoding='utf-8')
guild = values.get('DISCORD_GUILD_ID', '')
if not guild.isdigit() or not 15 <= len(guild) <= 22:
    raise SystemExit('Preencha DISCORD_GUILD_ID no .env antes de preparar a integração.')
digest = hashlib.sha256(token.encode()).hexdigest()
data_dir = ROOT / '.data'
data_dir.mkdir(exist_ok=True)
sql = f"""-- Executar no Supabase; contém somente um hash, nunca a chave original.
insert into public.worldforge_discord_bot_keys (name, guild_id, token_hash)
values ('WorldForge RPG', '{guild}', '{digest}')
on conflict (token_hash) do update set guild_id=excluded.guild_id, active=true;
"""
(data_dir / 'register-bridge.sql').write_text(sql, encoding='utf-8')
print('Arquivo .env preparado. Preencha DISCORD_TOKEN localmente.')
print('Registro da integração preparado em .data/register-bridge.sql (somente hash).')
