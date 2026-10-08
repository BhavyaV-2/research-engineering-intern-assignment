import numpy as np
import pandas as pd

import preprocess


def test_parse_jsonl_handles_valid_malformed_and_invalid_rows(tmp_path):
    data_file = tmp_path / "data.jsonl"
    data_file.write_text(
        "\n".join(
            [
                '{"data": {"id": "1", "title": "Title", "selftext": "Body", "author": "a1", "subreddit": "s1", "created_utc": 1, "url": "u1"}}',
                "{bad json",
                "[]",
            ]
        ),
        encoding="utf-8",
    )

    df = preprocess.parse_jsonl(str(data_file))

    assert len(df) == 1
    assert df.iloc[0]["full_text"] == "Title Body"


def test_calculate_bot_scores_covers_rules_and_empty_author():
    df = pd.DataFrame(
        [
            {"author": "bot", "created_utc": 0, "subreddit": "s1", "url": "u"},
            {"author": "bot", "created_utc": 30, "subreddit": "s2", "url": "u"},
            {"author": "bot", "created_utc": 50, "subreddit": "s3", "url": "u"},
            {"author": "", "created_utc": 0, "subreddit": "s1", "url": ""},
            {"author": "human", "created_utc": 0, "subreddit": "s1", "url": "x"},
        ]
    )

    out = preprocess.calculate_bot_scores(df)

    scores = dict(zip(out["author"], out["bot_suspicion_score"]))
    assert scores["bot"] == 100
    assert scores[""] == 0
    assert scores["human"] == 0


def test_generate_embeddings_and_umap(monkeypatch):
    class FakeModel:
        def encode(self, texts, **_kwargs):
            assert texts == ["a", "b"]
            return np.array([[1.0, 2.0], [3.0, 4.0]])

    class FakeUMAP:
        def __init__(self, **_kwargs):
            pass

        def fit_transform(self, embeddings):
            assert embeddings.shape == (2, 2)
            return np.array([[10.0, 11.0], [12.0, 13.0]])

    monkeypatch.setattr(preprocess, "SentenceTransformer", lambda _name: FakeModel())
    monkeypatch.setattr(preprocess.umap, "UMAP", FakeUMAP)

    df = pd.DataFrame([{"full_text": "a"}, {"full_text": "b"}])
    out = preprocess.generate_embeddings_and_umap(df)

    assert out["embedding"].iloc[0] == [1.0, 2.0]
    assert out["x_coord"].tolist() == [10.0, 12.0]
    assert out["y_coord"].tolist() == [11.0, 13.0]


def test_main_returns_early_when_parsed_df_empty(monkeypatch):
    called = {"value": False}

    monkeypatch.setattr(preprocess, "parse_jsonl", lambda _path: pd.DataFrame())
    monkeypatch.setattr(
        preprocess,
        "calculate_bot_scores",
        lambda _df: called.__setitem__("value", True),
    )

    preprocess.main()
    assert called["value"] is False


def test_main_full_pipeline_writes_parquet(monkeypatch):
    written = {"value": False}

    base_df = pd.DataFrame([{"full_text": "x"}])

    def fake_parse(_path):
        return base_df.copy()

    def fake_bot(df):
        df = df.copy()
        df["bot_suspicion_score"] = [1]
        return df

    def fake_embed(df):
        df = df.copy()
        df["embedding"] = [[0.1, 0.2]]
        df["x_coord"] = [1.0]
        df["y_coord"] = [2.0]

        def fake_to_parquet(_path, engine):
            written["value"] = engine == "pyarrow"

        df.to_parquet = fake_to_parquet
        return df

    monkeypatch.setattr(preprocess, "parse_jsonl", fake_parse)
    monkeypatch.setattr(preprocess, "calculate_bot_scores", fake_bot)
    monkeypatch.setattr(preprocess, "generate_embeddings_and_umap", fake_embed)

    preprocess.main()
    assert written["value"] is True
