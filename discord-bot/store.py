"""Configurações locais; mundos e vínculos ficam no Supabase."""
import sqlite3
import uuid
from pathlib import Path


class Store:
    FIELDS = frozenset({'welcome_channel', 'log_channel', 'auto_role'})

    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.execute('pragma journal_mode=WAL')
        self.db.execute('''create table if not exists guild_settings (
            guild_id integer primary key, welcome_channel integer,
            log_channel integer, auto_role integer)''')
        self.db.executescript('''
          create table if not exists server_panels (
            guild_id integer not null, section text not null, channel_id integer,
            message_id integer, thread_id integer, primary key(guild_id,section));
          create table if not exists server_roles (
            guild_id integer not null, name text not null, role_id integer not null,
            primary key(guild_id,name));
          create table if not exists ticket_config (
            guild_id integer primary key, staff_role_id integer not null, category_id integer not null);
          create table if not exists tickets (
            id text primary key, guild_id integer not null, owner_id integer not null,
            channel_id integer unique, kind text not null,
            status text not null default 'creating', created_at text not null default CURRENT_TIMESTAMP,
            closed_at text);
          create unique index if not exists tickets_active_owner
            on tickets(guild_id,owner_id) where status in ('creating','open','closing');
          create table if not exists forum_requests (
            interaction_id text primary key, thread_id integer,
            created_at text not null default CURRENT_TIMESTAMP);
        ''')
        if 'controls_message_id' not in {row[1] for row in self.db.execute('pragma table_info(server_panels)')}:
            self.db.execute('alter table server_panels add column controls_message_id integer')
        self.db.commit()

    def get(self, guild_id: int) -> dict:
        row = self.db.execute('select * from guild_settings where guild_id=?', (guild_id,)).fetchone()
        return dict(row) if row else {'welcome_channel': None, 'log_channel': None, 'auto_role': None}

    def set(self, guild_id: int, field: str, value: int | None):
        if field not in self.FIELDS:
            raise ValueError('Configuração inválida.')
        with self.db:
            self.db.execute('insert or ignore into guild_settings(guild_id) values (?)', (guild_id,))
            self.db.execute(f'update guild_settings set {field}=? where guild_id=?', (value, guild_id))

    def close(self):
        self.db.close()

    def panel(self, guild_id, section):
        row=self.db.execute('select * from server_panels where guild_id=? and section=?',(guild_id,section)).fetchone()
        return dict(row) if row else {}

    def save_panel(self,guild_id,section,channel_id,message_id=None,thread_id=None):
        with self.db:
            self.db.execute('''insert into server_panels(guild_id,section,channel_id,message_id,thread_id) values(?,?,?,?,?)
              on conflict(guild_id,section) do update set channel_id=excluded.channel_id,
              message_id=excluded.message_id,thread_id=excluded.thread_id,
              controls_message_id=case when server_panels.channel_id=excluded.channel_id
                then server_panels.controls_message_id else null end''',
              (guild_id,section,channel_id,message_id,thread_id))

    def save_controls(self,guild_id,section,message_id):
        with self.db:
            self.db.execute('update server_panels set controls_message_id=? where guild_id=? and section=?',
                            (message_id,guild_id,section))

    def set_role(self,guild_id,name,role_id):
        with self.db:
            self.db.execute('insert into server_roles values(?,?,?) on conflict(guild_id,name) do update set role_id=excluded.role_id',
                            (guild_id,name,role_id))

    def interest_roles(self,guild_id):
        return dict(self.db.execute('select name,role_id from server_roles where guild_id=?',(guild_id,)).fetchall())

    def tickets_config(self,guild_id):
        row=self.db.execute('select * from ticket_config where guild_id=?',(guild_id,)).fetchone()
        return dict(row) if row else None

    def set_tickets_config(self,guild_id,role_id,category_id):
        with self.db:
            self.db.execute('insert into ticket_config values(?,?,?) on conflict(guild_id) do update set staff_role_id=excluded.staff_role_id,category_id=excluded.category_id',
                            (guild_id,role_id,category_id))

    def reserve_ticket(self,guild_id,owner_id,kind):
        ticket_id=uuid.uuid4().hex
        with self.db:
            try:
                self.db.execute('insert into tickets(id,guild_id,owner_id,kind) values(?,?,?,?)',(ticket_id,guild_id,owner_id,kind))
            except sqlite3.IntegrityError:
                return None
        return ticket_id

    def user_ticket(self,guild_id,owner_id):
        row=self.db.execute("select * from tickets where guild_id=? and owner_id=? and status in ('creating','open','closing')",(guild_id,owner_id)).fetchone()
        return dict(row) if row else None

    def channel_ticket(self,channel_id):
        row=self.db.execute('select * from tickets where channel_id=?',(channel_id,)).fetchone()
        return dict(row) if row else None

    def ticket_state(self,ticket_id,status,channel_id=None):
        with self.db:
            self.db.execute('''update tickets set status=?,channel_id=coalesce(?,channel_id),
              closed_at=case when ?='closed' then CURRENT_TIMESTAMP else null end where id=?''',
              (status,channel_id,status,ticket_id))

    def reserve_forum(self,interaction_id):
        with self.db:
            return self.db.execute('insert or ignore into forum_requests(interaction_id) values(?)',(str(interaction_id),)).rowcount==1

    def finish_forum(self,interaction_id,thread_id):
        with self.db:
            self.db.execute('update forum_requests set thread_id=? where interaction_id=?',(thread_id,str(interaction_id)))

    def retry_forum(self,interaction_id):
        with self.db:
            self.db.execute('delete from forum_requests where interaction_id=? and thread_id is null',(str(interaction_id),))
