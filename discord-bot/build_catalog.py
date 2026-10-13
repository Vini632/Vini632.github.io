"""Extrai somente orientações permanentes do documento de canais."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
source = (ROOT / 'docs/world_forge_discord_canais.md').read_text(encoding='utf-8')
sections = list(re.finditer(r'^### (\d+\.\d+) `([^`]+)`[^\n]*', source, re.M))
groups = {'2':'Portal de Entrada','3':'Central World Forge','4':'Central de Suporte'}
titles = {'reportar-bugs':'🐛 LEIA ANTES DE REPORTAR UM BUG',
          'sugestões':'💡 COMO SUGERIR UMA MELHORIA', 'dúvidas':'❓ CENTRAL DE DÚVIDAS — COMECE AQUI'}
tags = {'reportar-bugs':['Novo','Em análise','Reproduzido','Corrigido','Duplicado','Não reproduzido'],
        'sugestões':['Nova ideia','Em avaliação','Planejada','Implementada','Não planejada'],
        'dúvidas':['Plataforma','Contas','Biblioteca','RPG','Resolvido']}


def quotes(block):
    return '\n'.join(line[1:].lstrip() if line.startswith('>') else ''
                     for line in block.splitlines() if line.startswith('>')).strip()


catalog = {}
for index, match in enumerate(sections):
    number, key = match.groups()
    block = source[match.end():sections[index+1].start() if index+1<len(sections) else source.index('\n## 5.')]
    if key == 'boas-vindas':
        catalog[key] = {'category':groups['2'],'kind':'preserved','title':'Boas-vindas da Loritta',
                        'body':'Automação existente preservada. O bot WorldForge não duplica boas-vindas nem o autorole Aventureiro.'}
        continue
    title = re.search(r'\*\*Título:\*\*\s*`([^`]+)`',block)
    author = re.search(r'\*\*Autor:\*\*\s*`([^`]+)`',block)
    footer = re.search(r'\*\*Rodapé:\*\*\s*`([^`]+)`',block)
    # Models are reference material, never announcements of unverified features.
    permanent = re.split(r'\*\*Modelo|\*\*Implementação:|\*\*Permissões:',block,maxsplit=1)[0]
    if key == 'abrir-ticket':
        active = quotes(block.split('**Texto definitivo, quando houver sistema de tickets funcional:**')[1].split('**Categorias sugeridas:**')[0])
        body = quotes(block.split('**Texto provisório, se ainda não existir bot de tickets:**')[1].split('**Implementação:**')[0])
    else:
        active = None
        body = quotes(permanent)
    parts = []
    if key == 'regras':
        fields = list(re.finditer(r'\*\*Field \d+ — `([^`]+)`\*\*[^\n]*',permanent))
        body = quotes(permanent[:fields[0].start()])
        for n, field in enumerate(fields):
            text = quotes(permanent[field.end():fields[n+1].start() if n+1<len(fields) else len(permanent)])
            parts.append({'heading':field.group(1),'text':text})
    template = ''
    model = re.search(r'\*\*Modelo[^\n]*\n',block)
    if model:
        template = quotes(block[model.end():].split('**Tags sugeridas:**')[0].split('**Permissões:**')[0])
    catalog[key] = {'category':groups[number[0]],'kind':'forum' if key in tags else 'text',
                    'title':title.group(1) if title else titles.get(key,key),
                    'author':author.group(1) if author else '✦ WORLD FORGE RPG • CENTRAL DE SUPORTE',
                    'footer':footer.group(1) if footer else '✦ WORLD FORGE RPG • Onde mundos ganham vida',
                    'body':body,'parts':parts,'template':template,'tags':tags.get(key,[])}
    if active:
        catalog[key]['active_body'] = active
(ROOT / 'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Catálogo gerado: {len(catalog)} canais, somente conteúdos permanentes.')
