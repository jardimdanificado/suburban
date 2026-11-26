#!/usr/bin/env python3
"""Gera js/generos_frequentes.js.

O gerador de cenas precisa do gênero do substantivo para escolher o artigo.
O classificador de js/vocabulario.js erra alguns casos: "lei", "voz", "paz" e
"mão" saem como "neutro" ou até masculino. Aqui o gênero vem do spaCy, que
acerta esses casos.

A lista reúne as palavras que o gerador pode escolher: a interseção do catálogo
com a lista de frequência e as chaves/variantes do léxico curado. Só entram
palavras que o spaCy reconhece como substantivo com gênero definido.

Uso:
    python3 scripts/gerar_generos_frequentes.py

Requisitos: spacy, o modelo pt_core_news_md e o node.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import spacy

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "js" / "generos_frequentes.js"
MODELO = "pt_core_news_md"

# Dump das palavras feito pelo node, para não duplicar a leitura do léxico.
DUMP = """
import {SUBSTANTIVOS} from './js/lexico_sinonimos.js';
import {PALAVRAS_FREQUENTES} from './js/vocabulario_frequente.js';
const palavras = new Set(PALAVRAS_FREQUENTES);
for (const [chave, variantes] of Object.entries(SUBSTANTIVOS)) {
  palavras.add(chave);
  for (const variante of variantes) palavras.add(variante.split(' ')[0]);
}
console.log(JSON.stringify([...palavras]));
"""

VALIDO = re.compile(r"^[a-zà-ú]{3,20}$")


def palavras_do_gerador() -> list[str]:
    resultado = subprocess.run(
        ["node", "--input-type=module", "-e", DUMP],
        cwd=RAIZ,
        check=True,
        capture_output=True,
        text=True,
    )
    palavras = json.loads(resultado.stdout.strip().splitlines()[-1])
    return sorted({p for p in palavras if isinstance(p, str) and VALIDO.match(p)})


def genero_do_doc(doc, palavra: str) -> str | None:
    for token in doc:
        if token.text.lower() == palavra:
            generos = token.morph.get("Gender")
            if "Fem" in generos:
                return "f"
            if "Masc" in generos:
                return "m"
    return None


def main() -> None:
    palavras = palavras_do_gerador()
    nlp = spacy.load(MODELO)

    generos: dict[str, str] = {}
    # Uma passada: palavra nua. Aceita o gênero mesmo quando o spaCy marca a
    # palavra como verbo, porque "vista" e "mão" traem o gênero no morph.
    for palavra, doc in zip(palavras, nlp.pipe(palavras, batch_size=256)):
        genero = genero_do_doc(doc, palavra)
        if genero:
            generos[palavra] = genero

    # Segunda passada para homógrafos sem gênero na forma nua, como "trem".
    # Testa "o <palavra>" e "a <palavra>". Quando os dois discordam, o artigo
    # do teste é que manda no gênero, então a palavra fica de fora.
    faltantes = [p for p in palavras if p not in generos]
    masculinos = {p: genero_do_doc(doc, p) for p, doc in zip(faltantes, nlp.pipe(("o " + p for p in faltantes), batch_size=256))}
    femininos = {p: genero_do_doc(doc, p) for p, doc in zip(faltantes, nlp.pipe(("a " + p for p in faltantes), batch_size=256))}
    for palavra in faltantes:
        com_o, com_a = masculinos[palavra], femininos[palavra]
        if com_o and com_a and com_o != com_a:
            continue
        genero = com_o or com_a
        if genero:
            generos[palavra] = genero

    linhas = [
        "// Gerado por scripts/gerar_generos_frequentes.py. Não edite à mão.",
        "//",
        "// Gênero de substantivo conferido pelo spaCy pt_core_news_md para as",
        "// palavras que o gerador de cenas pode escolher. O gerador usa este mapa",
        "// para escolher o artigo.",
        "",
        "export const GENEROS_FREQUENTES = Object.freeze({",
    ]
    for palavra in sorted(generos):
        linhas.append(f"  {json.dumps(palavra)}: {json.dumps(generos[palavra])},")
    linhas.append("});")
    linhas.append("")
    SAIDA.write_text("\n".join(linhas), encoding="utf-8")

    fem = sum(1 for g in generos.values() if g == "f")
    print(f"{len(generos)} gêneros ({fem} femininos) gravados em {SAIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
