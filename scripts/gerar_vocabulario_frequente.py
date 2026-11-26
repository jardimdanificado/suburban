#!/usr/bin/env python3
"""Gera js/vocabulario_frequente.js a partir do catálogo do jogo.

O catálogo de js/vocabulario.js é um dicionário extenso: além das palavras do
dia a dia, guarda termos técnicos e obsoletos. Para o gerador de textos montar
frases com vocabulário comum, este script cruza o catálogo com uma lista de
frequência do português e grava só as palavras que aparecem nos dois.

Requisitos: wordfreq (`pip install wordfreq`). O resultado é determinístico
para a mesma versão da biblioteca.

Uso:
    python3 scripts/gerar_vocabulario_frequente.py [limite]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from wordfreq import top_n_list

RAIZ = Path(__file__).resolve().parent.parent
CATALOGO = RAIZ / "js" / "vocabulario.js"
SAIDA = RAIZ / "js" / "vocabulario_frequente.js"
VERBOS = RAIZ / "scripts" / "dados" / "verbos_pt.txt"

VALIDO = re.compile(r"^[a-záéíóúâêôãõçà-ú]{4,16}$")


def verbos_do_dicionario() -> set[str]:
    """Lista de verbos do pt-br (fserb/pt-br, licença MIT).

    Serve para separar infinitivos de verdade de palavras que só terminam em
    -ar/-er/-ir, como "designer" e "twitter".
    """
    if not VERBOS.exists():
        raise SystemExit(f"lista de verbos não encontrada: {VERBOS}")
    return {linha.strip() for linha in VERBOS.read_text(encoding="utf-8").splitlines() if linha.strip()}


def palavras_do_catalogo() -> set[str]:
    texto = CATALOGO.read_text(encoding="utf-8")
    # O catálogo é um objeto JS com a lista "palavras": [...].
    inicio = texto.find('"palavras"')
    if inicio < 0:
        raise SystemExit("lista 'palavras' não encontrada em vocabulario.js")
    abre = texto.find("[", inicio)
    fecha = texto.find("]", abre)
    while fecha > 0 and texto[fecha - 1] == "\\":
        fecha = texto.find("]", fecha + 1)
    bloco = texto[abre + 1 : fecha]
    return set(json.loads("[" + bloco + "]"))


def main() -> None:
    limite = int(sys.argv[1]) if len(sys.argv) > 1 else 12000
    catalogo = palavras_do_catalogo()
    escolhidas: list[str] = []
    vistos: set[str] = set()
    for bruta in top_n_list("pt", limite * 2):
        palavra = bruta.strip().lower()
        if palavra in vistos or not VALIDO.match(palavra):
            continue
        if palavra not in catalogo:
            continue
        vistos.add(palavra)
        escolhidas.append(palavra)
        if len(escolhidas) >= limite:
            break

    linhas = [
        "// Gerado por scripts/gerar_vocabulario_frequente.py. Não edite à mão.",
        "//",
        "// Interseção entre o catálogo de js/vocabulario.js e uma lista de",
        "// frequência do português. Serve de ponto de partida para o gerador de",
        "// cenas montar frases com vocabulário comum.",
        "export const PALAVRAS_FREQUENTES = Object.freeze([",
    ]
    for i in range(0, len(escolhidas), 8):
        linhas.append("  " + ", ".join(json.dumps(p) for p in escolhidas[i : i + 8]) + ",")
    linhas.append("]);")
    linhas.append("")

    # Infinitivos de verdade: a interseção com o dicionário de verbos evita
    # palavras que apenas terminam em -ar/-er/-ir, como "designer".
    verbos = sorted(
        palavra for palavra in escolhidas if palavra in verbos_do_dicionario()
    )
    linhas.append("// Subconjunto de PALAVRAS_FREQUENTES conferido contra a lista de")
    linhas.append("// verbos de fserb/pt-br. O gerador de cenas usa esta lista como")
    linhas.append("// fonte de verbos.")
    linhas.append("export const VERBOS_FREQUENTES = Object.freeze([")
    for i in range(0, len(verbos), 8):
        linhas.append("  " + ", ".join(json.dumps(p) for p in verbos[i : i + 8]) + ",")
    linhas.append("]);")
    linhas.append("")
    SAIDA.write_text("\n".join(linhas), encoding="utf-8")
    print(f"{len(escolhidas)} palavras e {len(verbos)} verbos gravados em {SAIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
