#!/usr/bin/env python3
"""Extrai os padrões gramaticais do banco de cenas antigo.

O arquivo js/cenas_padroes.js guarda só a estrutura: artigo, substantivo,
adjetivo, preposição e alguns advérbios de função gramatical. Nenhum
substantivo, verbo ou adjetivo de conteúdo fica gravado nesse arquivo. O
preenchimento fica por conta de js/cenas_do_vocabulario.js.

Como os adjetivos são palavras de conteúdo, eles saem em um recurso de
vocabulário separado, js/adjetivos_frequentes.js, conferido contra o
catálogo de js/vocabulario.js. O banco de cenas continua sendo só estrutura.

Entrada: um JSON com as cenas antigas, no formato
    [{"tema": "politica", "s": "A prefeitura", "v": "aprovar",
      "o": "o orçamento", "c": "no conselho"}, ...]

Uso:
    python3 scripts/extrair_padroes_cenas.py cenas.json

Requisitos: spacy e o modelo pt_core_news_md.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

import spacy

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "js" / "cenas_padroes.js"
SAIDA_ADJETIVOS = RAIZ / "js" / "adjetivos_frequentes.js"
CATALOGO = RAIZ / "js" / "vocabulario.js"

# Artigos e contrações. A contração é separada em preposição + artigo para o
# gerador escolher o gênero e o número do substantivo preenchido.
CONTRACOES = {
    "do": ("de", "def", "s"),
    "da": ("de", "def", "s"),
    "dos": ("de", "def", "p"),
    "das": ("de", "def", "p"),
    "no": ("em", "def", "s"),
    "na": ("em", "def", "s"),
    "nos": ("em", "def", "p"),
    "nas": ("em", "def", "p"),
    "pelo": ("por", "def", "s"),
    "pela": ("por", "def", "s"),
    "pelos": ("por", "def", "p"),
    "pelas": ("por", "def", "p"),
    "ao": ("a", "def", "s"),
    "aos": ("a", "def", "p"),
    "à": ("a", "def", "s"),
    "às": ("a", "def", "p"),
}

ARTIGOS_DEF = {"a": "s", "o": "s", "as": "p", "os": "p"}
ARTIGOS_INDEF = {"um": "s", "uma": "s", "uns": "p", "umas": "p"}

PREPOSICOES = {
    "a", "após", "até", "com", "como", "contra", "de", "desde", "diante",
    "durante", "em", "entre", "para", "por", "sem", "sob", "sobre",
}

# Advérbios, conjunções e quantificadores que fazem parte da estrutura da
# frase, não do conteúdo da cena. Adjetivos de conteúdo, como "mesmo",
# "cheio" e "juntas", ficam de fora: o gerador os preenche com o vocabulário.
FIXAS = {
    "antes", "depois", "perto", "atrás", "cedo", "tarde", "mais", "não",
    "diretamente", "conforme", "e", "ou",
    "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
    "onze", "doze", "treze", "quatorze", "quinze", "dezesseis",
    "dezessete", "dezoito", "dezenove", "vinte", "trinta", "cem",
}

# Formas que, na frase, funcionam como artigo indefinido plural.
INDEF_PLURAL = {"dois", "duas"}
DEF_PLURAL = {"todos", "todas"}

nlp = spacy.load("pt_core_news_md")


def tags_da_frase(frase: str) -> list[tuple[str, str, str, str]]:
    """Devolve (texto, pos, lemma, morfologia) para cada palavra da frase."""
    bruto = frase.split()
    doc = nlp(frase)
    por_texto: dict[str, list] = defaultdict(list)
    for token in doc:
        por_texto[token.text.lower()].append(token)
    saida = []
    for palavra in bruto:
        opcoes = por_texto.get(palavra.lower(), [])
        if opcoes:
            token = opcoes.pop(0)
            saida.append((palavra, token.pos_, token.lemma_, token.morph))
        else:
            # Palavra composta ou sigla que o spaCy separou.
            mini = nlp(palavra)
            if mini:
                token = mini[0]
                saida.append((palavra, token.pos_, token.lemma_, token.morph))
            else:
                saida.append((palavra, "NOUN", palavra.lower(), ""))
    return saida


def numero_do_morph(morph) -> str | None:
    valores = morph.get("Number") if morph else []
    if "Plur" in valores:
        return "p"
    if "Sing" in valores:
        return "s"
    return None


def genero_do_morph(morph) -> str | None:
    valores = morph.get("Gender") if morph else []
    if "Fem" in valores:
        return "f"
    if "Masc" in valores:
        return "m"
    return None


def genero_da_forma(palavra: str) -> str | None:
    chave = palavra.lower()
    if chave.endswith("as") or chave.endswith("a"):
        return "f"
    if chave.endswith("os") or chave.endswith("o"):
        return "m"
    return None


def numero_da_forma(palavra: str) -> str | None:
    chave = palavra.lower()
    if chave.endswith(("as", "os", "es", "is", "ais", "eis", "ois", "uis", "ns")):
        return "p"
    return None


def tokens_da_frase(frase: str, papel: str) -> tuple[list[str], list[tuple[str, str, str, str]]]:
    """Converte uma frase antiga em tokens estruturais.

    Papel: 's' (sujeito) ou 'o' (objeto) começam com artigo; 'c' é complemento.
    """
    tokens: list[str] = []
    adjetivos: list[tuple[str, str, str, str]] = []
    palavras = tags_da_frase(frase)
    for indice, (palavra, pos, lemma, morph) in enumerate(palavras):
        chave = palavra.lower()
        if chave in CONTRACOES:
            prep, artigo, numero = CONTRACOES[chave]
            tokens.extend([f"p:{prep}", "a" if numero == "s" else "A"])
            continue
        if chave in ARTIGOS_DEF:
            tokens.append("a" if ARTIGOS_DEF[chave] == "s" else "A")
            continue
        if chave in ARTIGOS_INDEF:
            tokens.append("i" if ARTIGOS_INDEF[chave] == "s" else "I")
            continue
        if chave in DEF_PLURAL:
            tokens.append("A")
            continue
        if chave in INDEF_PLURAL:
            tokens.append("I")
            continue
        if chave in PREPOSICOES:
            tokens.append(f"p:{chave}")
            continue
        if chave in FIXAS:
            tokens.append(f"f:{chave}")
            continue
        if pos == "ADJ":
            adjetivos.append((chave, pos, lemma, morph))
            tokens.append("j")
            continue
        if pos in {"VERB", "AUX"} and papel == "c" and tokens and tokens[-1].startswith("p:"):
            # Complemento com infinitivo: "a pescar", "a beber água".
            tokens.append("V")
            continue
        if pos in {"VERB", "AUX"} and "Part" in morph.get("VerbForm", []):
            # Particípio com gênero concorda como adjetivo de predicado:
            # "juntas", "cheios". O gerador preenche o adjetivo.
            tokens.append("j")
            continue
        # Substantivo (inclusive infinitivo nominalizado depois de artigo).
        numero = numero_do_morph(morph) or numero_da_forma(chave)
        if not numero:
            if indice > 0:
                anterior = palavras[indice - 1][0].lower()
                if anterior in ARTIGOS_DEF:
                    numero = ARTIGOS_DEF[anterior]
                elif anterior in ARTIGOS_INDEF:
                    numero = ARTIGOS_INDEF[anterior]
                elif anterior in CONTRACOES:
                    numero = CONTRACOES[anterior][2]
        tokens.append("n" if numero != "p" else "N")
    return tokens, adjetivos


def verbo_e_complemento(cena: dict) -> tuple[str, str | None]:
    """Classifica o verbo e devolve a preposição que rege o complemento."""
    if cena.get("o"):
        return "t", None
    complemento = cena.get("c") or ""
    tokens, _ = tokens_da_frase(complemento, "c") if complemento else ([], [])
    for token in tokens:
        if token.startswith("p:"):
            return "p", token[2:]
        if token.startswith("n") or token == "j":
            break
    return "i", None


def garantir_nucleo(tokens: list[str]) -> list[str]:
    """Dá um substantivo à frase que só tem adjetivo.

    Em "em geral" e "a alta", a palavra de conteúdo que o spaCy marcou como
    adjetivo ocupa o lugar do núcleo. O gerador preenche esse lugar com um
    substantivo, então a marca vira "n" para a frase não ficar sem cabeça.
    """
    if any(token in ("n", "N", "V") for token in tokens):
        return tokens
    if "j" in tokens:
        trocado = list(tokens)
        trocado[trocado.index("j")] = "n"
        return trocado
    return tokens


def palavras_do_catalogo() -> set[str]:
    """Lê a lista "palavras" de js/vocabulario.js."""
    texto = CATALOGO.read_text(encoding="utf-8")
    inicio = texto.find('"palavras"')
    if inicio < 0:
        raise SystemExit("lista 'palavras' não encontrada em js/vocabulario.js")
    abre = texto.find("[", inicio)
    fecha = texto.find("]", abre)
    while fecha > 0 and texto[fecha - 1] == "\\":
        fecha = texto.find("]", fecha + 1)
    return set(json.loads("[" + texto[abre + 1 : fecha] + "]"))


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("uso: python3 scripts/extrair_padroes_cenas.py cenas.json")
    cenas = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))

    padroes: dict[str, list[dict]] = defaultdict(list)
    vistos: dict[str, set] = defaultdict(set)
    adjetivos: dict[str, set[str]] = defaultdict(set)

    for cena in cenas:
        tema = cena.get("tema") or "cotidiano"
        s, adjs_s = tokens_da_frase(cena["s"], "s")
        o, adjs_o = tokens_da_frase(cena["o"], "o") if cena.get("o") else ([], [])
        c, adjs_c = tokens_da_frase(cena["c"], "c") if cena.get("c") else ([], [])
        s = garantir_nucleo(s)
        o = garantir_nucleo(o)
        # No complemento, um "j" sozinho é predicado e concorda com o sujeito:
        # "juntas", "cheio pela manhã". Não vira núcleo.
        tipo, _ = verbo_e_complemento(cena)

        for palavra, pos, lemma, morph in adjs_s + adjs_o + adjs_c:
            # A terminação é mais segura que o morph do spaCy para formas
            # invariantes: "social"/"sociais" servem aos dois gêneros.
            chave_surface = palavra.lower()
            if chave_surface.endswith(("as", "a")):
                genero, numero = "f", "s" if chave_surface.endswith("a") else "p"
            elif chave_surface.endswith(("os", "o")):
                genero, numero = "m", "s" if chave_surface.endswith("o") else "p"
            else:
                genero = "x"
                numero = numero_do_morph(morph) or (
                    "p" if chave_surface.endswith(
                        ("es", "is", "ais", "eis", "ois", "uis", "ns")
                    ) else "s"
                )
            adjetivos[f"{genero}{numero}"].add(palavra)

        assinatura = (tuple(s), tuple(o), tuple(c), tipo)
        if assinatura in vistos[tema]:
            continue
        vistos[tema].add(assinatura)
        padroes[tema].append({
            "s": " ".join(s),
            "t": tipo,
            **({"o": " ".join(o)} if o else {}),
            **({"c": " ".join(c)} if c else {}),
        })

    linhas = [
        "// Gerado por scripts/extrair_padroes_cenas.py. Não edite à mão.",
        "//",
        "// Só estrutura: artigo, substantivo, adjetivo, preposição e advérbio",
        "// gramatical. Nenhum substantivo, verbo ou adjetivo de conteúdo fica",
        "// gravado aqui. O preenchimento usa js/vocabulario.js e o recurso de",
        "// vocabulário js/adjetivos_frequentes.js.",
        "",
        "export const PADROES = {",
    ]
    for tema in sorted(padroes):
        linhas.append(f"  {tema}: [")
        for padrao in padroes[tema]:
            linhas.append(f"    {json.dumps(padrao, ensure_ascii=False)},")
        linhas.append("  ],")
    linhas.append("};")
    linhas.append("")
    SAIDA.write_text("\n".join(linhas), encoding="utf-8")

    # Recurso de vocabulário: os adjetivos vistos nas cenas antigas, separados
    # em formas masculinas/femininas e singulares/plurais. Cada forma é
    # conferida contra o catálogo do jogo antes de ser gravada.
    catalogo = palavras_do_catalogo()
    adj_linhas = [
        "// Gerado por scripts/extrair_padroes_cenas.py. Não edite à mão.",
        "//",
        "// Recurso de vocabulário: formas de adjetivo, agrupadas por gênero e",
        "// número, conferidas contra js/vocabulario.js. O banco de cenas usa esta",
        "// lista só como fonte de modificadores; nenhum adjetivo fica gravado em",
        "// js/cenas_padroes.js.",
        "",
        "export const ADJETIVOS_FREQUENTES = Object.freeze({",
    ]
    for chave in ("xs", "ms", "fs", "mp", "fp", "xp"):
        itens = sorted(
            palavra
            for palavra in adjetivos.get(chave, set())
            if palavra in catalogo
        )
        adj_linhas.append(f"  {chave}: Object.freeze([")
        for i in range(0, len(itens), 8):
            adj_linhas.append("    " + ", ".join(json.dumps(v, ensure_ascii=False) for v in itens[i:i + 8]) + ",")
        adj_linhas.append("  ]),")
    adj_linhas.append("});")
    adj_linhas.append("")
    SAIDA_ADJETIVOS.write_text("\n".join(adj_linhas), encoding="utf-8")

    total = sum(len(v) for v in padroes.values())
    print(f"{total} padrões gravados em {SAIDA.relative_to(RAIZ)}")
    for chave in ("xs", "ms", "fs", "mp", "fp", "xp"):
        print(f"adjetivos {chave}: {len(adjetivos.get(chave, set()))}")
    print(f"adjetivos gravados em {SAIDA_ADJETIVOS.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
