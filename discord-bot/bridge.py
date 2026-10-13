import asyncio
import aiohttp


class BridgeError(Exception):
    pass


class Bridge:
    def __init__(self, url: str, token: str, guild_id: int):
        self.url, self.token, self.guild_id = url, token, str(guild_id)
        self.session: aiohttp.ClientSession | None = None

    async def start(self):
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=25))

    async def close(self):
        if self.session:
            await self.session.close()

    async def call(self, action: str, user, **kwargs):
        if not self.token or not self.session:
            raise BridgeError('A integração com o site ainda precisa ser configurada pelo administrador.')
        payload = {'action': action, 'discord_user_id': str(user.id), 'guild_id': self.guild_id, **kwargs}
        try:
            async with self.session.post(self.url, json=payload, headers={
                'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'
            }) as response:
                body = await response.json(content_type=None)
                if response.status != 200:
                    messages = {
                        401: 'A chave de integração do bot não está autorizada.',
                        403: 'Este servidor não está autorizado na integração.',
                        404: 'Use /vincular antes de acessar seus mundos.',
                        429: 'Aguarde um pouco antes de tentar novamente.',
                        503: 'A integração com o site está indisponível no momento.'
                    }
                    raise BridgeError(messages.get(response.status, 'Não foi possível concluir a integração.'))
                return body
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as exc:
            raise BridgeError('Não foi possível conectar ao WorldForge. Tente mais tarde.') from exc
