from backend.contracts import Answer


class TestModels:
    embedding_model = "atlas-test-only"

    def embed(self, texts):
        return [[1.0, 0.1] if "clorofila" in t.lower() else [0.1, 1.0] for t in texts]

    def generate(self, q, history, sources):
        return Answer(
            answer="A clorofila absorve luz.",
            citations=[sources[0]["id"]],
            question="Qual pigmento absorve luz?",
            expected="Clorofila",
        ), 20
