"""Avalia saídas observadas do recuperador e do tutor contra o corpus PT-BR."""

import argparse
import json
import math
from pathlib import Path
from statistics import mean, median

CASES = Path(__file__).with_name("cases.json")


def evaluate(rows, k):
    cases = {case["id"]: case for case in json.loads(CASES.read_text())}
    if k < 1 or len(rows) != len(cases) or {r["id"] for r in rows} != set(cases):
        raise ValueError("Inclua uma linha por caso e informe k positivo.")
    precision, recall, abstention, durations = [], [], [], []
    outside, citations, hidden = [], [], []
    usage = []
    for row in rows:
        case = cases[row["id"]]
        allowed, gold = set(case["selected"]), set(case["gold"])
        retrieved, cited = row["retrieved"], row["cited"]
        if any(
            not isinstance(names, list)
            or not all(isinstance(name, str) for name in names)
            for names in (retrieved, cited)
        ):
            raise ValueError(f"{case['id']}: use listas de nomes de arquivos.")
        if type(row["abstained"]) is not bool:
            raise ValueError("Anote abstained como um booleano.")
        distinct = list(dict.fromkeys(retrieved))[:k]
        hits = len(set(distinct) & gold)
        if gold:
            precision.append(hits / min(k, len(allowed)))
            recall.append(hits / len(gold))
            if row["abstained"]:
                hidden.append(row["id"])
        else:
            abstention.append(int(row["abstained"]))
        if (set(retrieved) | set(cited)) - allowed:
            outside.append(row["id"])
        if set(cited) - set(retrieved):
            citations.append(row["id"])
        latency = row["latency_ms"]
        if (
            type(latency) not in (int, float)
            or not math.isfinite(latency)
            or latency < 0
        ):
            raise ValueError("Latência inválida.")
        durations.append(latency)
        if row.get("tokens") is not None:
            if type(row["tokens"]) is not int or row["tokens"] < 0:
                raise ValueError("Contagem de tokens inválida.")
            usage.append(row["tokens"])
    return {
        "k": k,
        "answerable": len(precision),
        "unanswerable": len(abstention),
        "macro_document_precision": mean(precision),
        "macro_document_recall": mean(recall),
        "correct_abstention_rate": mean(abstention),
        "unnecessary_abstentions": hidden,
        "outside_selection": outside,
        "citations_absent_from_retrieval": citations,
        "median_latency_ms": median(durations),
        "reported_tokens": sum(usage) if usage else None,
        "queries_reporting_tokens": len(usage),
    }


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("results", type=Path)
    cli.add_argument("--k", type=int, default=2)
    args = cli.parse_args()
    result = evaluate(json.loads(args.results.read_text()), args.k)
    print(json.dumps(result, ensure_ascii=False, indent=2))
