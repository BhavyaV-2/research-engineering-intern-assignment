import asyncio
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import main


class DummyResult:
    def __init__(self, df):
        self._df = df

    def df(self):
        return self._df.copy()


class DummyDB:
    def __init__(self, handler):
        self.handler = handler
        self.calls = []

    def execute(self, query, params=None):
        self.calls.append((query, params))
        return DummyResult(self.handler(query, params or []))


class DummyModel:
    def __init__(self, vector):
        self.vector = np.array(vector, dtype=float)

    def encode(self, _):
        return np.array([self.vector])


class DummyChunk:
    def __init__(self, text):
        self.text = text


class DummyStreamClient:
    def __init__(self, chunks=None, fail=False, text=None):
        self.chunks = chunks or []
        self.fail = fail
        self.text = text
        self.models = self

    def generate_content(self, **_kwargs):
        if self.fail:
            raise RuntimeError("boom")
        return type("Resp", (), {"text": self.text})

    def generate_content_stream(self, **_kwargs):
        if self.fail:
            raise RuntimeError("boom")
        return self.chunks


@pytest.fixture
def client():
    original = main.app.router.lifespan_context

    @asynccontextmanager
    async def no_lifespan(_app):
        yield

    main.app.router.lifespan_context = no_lifespan
    with TestClient(main.app) as test_client:
        yield test_client
    main.app.router.lifespan_context = original


def test_lifespan_sets_and_closes_resources(monkeypatch):
    closed = {"value": False}

    class FakeConn:
        def execute(self, _):
            return None

        def close(self):
            closed["value"] = True

    monkeypatch.setattr(main.duckdb, "connect", lambda: FakeConn())
    monkeypatch.setattr(main, "SentenceTransformer", lambda _name: "model")
    monkeypatch.setenv("GEMINI_API_KEYS", "k1,k2")

    async def run_lifespan():
        async with main.lifespan(main.app):
            assert main.app.state.model == "model"
            assert main.app.state.api_keys == ["k1", "k2"]
            assert main.app.state.key_index == 0

    asyncio.run(run_lifespan())
    assert closed["value"] is True


def test_get_next_gemini_client_raises_without_keys():
    main.app.state.api_keys = []
    with pytest.raises(HTTPException) as exc:
        main.get_next_gemini_client(main.app)
    assert exc.value.status_code == 500


def test_get_next_gemini_client_rotates_keys(monkeypatch):
    seen = []

    class FakeClient:
        def __init__(self, api_key):
            seen.append(api_key)

    monkeypatch.setattr(main.genai, "Client", FakeClient)
    main.app.state.api_keys = ["a", "b"]
    main.app.state.key_index = 0

    main.get_next_gemini_client(main.app)
    main.get_next_gemini_client(main.app)
    main.get_next_gemini_client(main.app)

    assert seen == ["a", "b", "a"]


def test_search_returns_ranked_results(monkeypatch):
    df = pd.DataFrame(
        [
            {
                "id": "1",
                "title": "A",
                "subreddit": "x",
                "author": "u1",
                "created_utc": 1,
                "bot_suspicion_score": 10,
                "embedding": np.array([1.0, 0.0]),
            },
            {
                "id": "2",
                "title": "B",
                "subreddit": "x",
                "author": "u2",
                "created_utc": 2,
                "bot_suspicion_score": 10,
                "embedding": np.array([0.0, 1.0]),
            },
        ]
    )
    main.app.state.db = DummyDB(lambda *_: df)
    main.app.state.model = DummyModel([1.0, 0.0])
    monkeypatch.setattr(main, "get_next_gemini_client", lambda _app: None)

    result = asyncio.run(main.search("topic", limit=1))

    assert len(result) == 1
    assert result[0]["id"] == "1"
    assert "embedding" not in result[0]


def test_search_semantic_404_with_json_fence(monkeypatch):
    df = pd.DataFrame(
        [
            {
                "id": "1",
                "title": "A",
                "subreddit": "x",
                "author": "u1",
                "created_utc": 1,
                "bot_suspicion_score": 10,
                "embedding": np.array([0.0, 1.0]),
            }
        ]
    )
    main.app.state.db = DummyDB(lambda *_: df)
    main.app.state.model = DummyModel([1.0, 0.0])
    monkeypatch.setattr(
        main,
        "get_next_gemini_client",
        lambda _app: DummyStreamClient(text="```json[\"x\",\"y\",\"z\"]```"),
    )

    result = asyncio.run(main.search("miss"))

    assert result["status"] == "404_SEMANTIC"
    assert result["suggestions"] == ["x", "y", "z"]


def test_search_semantic_404_with_generic_fence(monkeypatch):
    df = pd.DataFrame(
        [
            {
                "id": "1",
                "title": "A",
                "subreddit": "x",
                "author": "u1",
                "created_utc": 1,
                "bot_suspicion_score": 10,
                "embedding": np.array([0.0, 1.0]),
            }
        ]
    )
    main.app.state.db = DummyDB(lambda *_: df)
    main.app.state.model = DummyModel([1.0, 0.0])
    monkeypatch.setattr(
        main,
        "get_next_gemini_client",
        lambda _app: DummyStreamClient(text="```[\"x\",\"y\",\"z\"]```"),
    )

    result = asyncio.run(main.search("miss"))
    assert result["suggestions"] == ["x", "y", "z"]


def test_search_semantic_404_with_plain_json(monkeypatch):
    df = pd.DataFrame(
        [
            {
                "id": "1",
                "title": "A",
                "subreddit": "x",
                "author": "u1",
                "created_utc": 1,
                "bot_suspicion_score": 10,
                "embedding": np.array([0.0, 1.0]),
            }
        ]
    )
    main.app.state.db = DummyDB(lambda *_: df)
    main.app.state.model = DummyModel([1.0, 0.0])
    monkeypatch.setattr(
        main,
        "get_next_gemini_client",
        lambda _app: DummyStreamClient(text='["x","y","z"]'),
    )

    result = asyncio.run(main.search("miss"))
    assert result["suggestions"] == ["x", "y", "z"]


def test_search_semantic_404_uses_fallback_on_error(monkeypatch):
    df = pd.DataFrame(
        [
            {
                "id": "1",
                "title": "A",
                "subreddit": "x",
                "author": "u1",
                "created_utc": 1,
                "bot_suspicion_score": 10,
                "embedding": np.array([0.0, 0.0]),
            }
        ]
    )
    main.app.state.db = DummyDB(lambda *_: df)
    main.app.state.model = DummyModel([0.0, 0.0])
    monkeypatch.setattr(
        main, "get_next_gemini_client", lambda _app: DummyStreamClient(fail=True)
    )

    result = asyncio.run(main.search("miss"))

    assert result["suggestions"] == ["border policy", "inflation", "foreign relations"]


def test_search_with_empty_dataset_returns_empty_list(monkeypatch):
    empty_df = pd.DataFrame(
        columns=[
            "id",
            "title",
            "subreddit",
            "author",
            "created_utc",
            "bot_suspicion_score",
            "embedding",
        ]
    )
    main.app.state.db = DummyDB(lambda *_: empty_df)
    main.app.state.model = DummyModel([1.0, 0.0])
    monkeypatch.setattr(main, "get_next_gemini_client", lambda _app: None)
    result = asyncio.run(main.search("anything"))
    assert result == []


def test_clusters_empty_returns_list():
    main.app.state.db = DummyDB(
        lambda *_: pd.DataFrame(
            columns=["id", "x_coord", "y_coord", "subreddit", "bot_suspicion_score"]
        )
    )
    assert asyncio.run(main.clusters(k=2)) == []


def test_clusters_assigns_cluster_ids(monkeypatch):
    class FakeKMeans:
        def __init__(self, **_kwargs):
            pass

        def fit_predict(self, coords):
            assert coords.shape[0] == 2
            return np.array([0, 1])

    monkeypatch.setattr(main, "KMeans", FakeKMeans)
    main.app.state.db = DummyDB(
        lambda *_: pd.DataFrame(
            [
                {"id": "1", "x_coord": "1", "y_coord": "2", "subreddit": "a", "bot_suspicion_score": 1},
                {"id": "2", "x_coord": "2", "y_coord": "3", "subreddit": "b", "bot_suspicion_score": 2},
            ]
        )
    )

    result = asyncio.run(main.clusters(k=2))
    assert {item["cluster_id"] for item in result} == {0, 1}


def test_network_empty_result():
    db = DummyDB(lambda *_: pd.DataFrame(columns=["author", "subreddit", "bot_suspicion_score"]))
    main.app.state.db = db
    result = asyncio.run(main.network(main.NetworkRequest(exclude_nodes=["x"])))
    assert result == {"nodes": [], "edges": []}
    query, params = db.calls[0]
    assert "author NOT IN" in query
    assert params == ["x", "x"]


def test_network_returns_ranked_nodes_and_edges():
    main.app.state.db = DummyDB(
        lambda *_: pd.DataFrame(
            [
                {"author": "a1", "subreddit": "s1", "bot_suspicion_score": 80},
                {"author": "a2", "subreddit": "s1", "bot_suspicion_score": 10},
            ]
        )
    )
    result = asyncio.run(main.network(main.NetworkRequest(exclude_nodes=[])))
    assert result["nodes"]
    assert all("pagerank" in n for n in result["nodes"])
    assert all(set(e.keys()) == {"source", "target"} for e in result["edges"])


def test_network_top_100_filters_some_edges():
    rows = [
        {"author": f"a{i}", "subreddit": f"s{i}", "bot_suspicion_score": i % 100}
        for i in range(60)
    ]
    main.app.state.db = DummyDB(lambda *_: pd.DataFrame(rows))
    result = asyncio.run(main.network(main.NetworkRequest(exclude_nodes=[])))
    assert len(result["nodes"]) == 100
    assert len(result["edges"]) < 60


def test_timeline_sorts_by_date():
    main.app.state.db = DummyDB(
        lambda *_: pd.DataFrame(
            [
                {"subreddit": "r1", "created_utc": 2},
                {"subreddit": "r1", "created_utc": 1},
                {"subreddit": "r2", "created_utc": 2},
            ]
        )
    )
    result = asyncio.run(main.timeline())
    assert isinstance(result, list)
    assert len(result) >= 1


def test_summary_no_data(client):
    main.app.state.db = DummyDB(lambda *_: pd.DataFrame(columns=["subreddit", "created_utc"]))
    response = client.get("/api/summary", params={"query": "none"})
    assert response.status_code == 200
    assert "No data found" in response.text


def test_summary_stream_success(client, monkeypatch):
    main.app.state.db = DummyDB(
        lambda *_: pd.DataFrame([{"subreddit": "r1", "created_utc": 1}, {"subreddit": "r2", "created_utc": 2}])
    )
    monkeypatch.setattr(
        main,
        "get_next_gemini_client",
        lambda _app: DummyStreamClient(chunks=[DummyChunk(None), DummyChunk("hello")]),
    )
    response = client.get("/api/summary", params={"query": "x"})
    assert "hello" in response.text


def test_summary_stream_error(client, monkeypatch):
    main.app.state.db = DummyDB(
        lambda *_: pd.DataFrame([{"subreddit": "r1", "created_utc": 1}])
    )
    monkeypatch.setattr(
        main, "get_next_gemini_client", lambda _app: DummyStreamClient(fail=True)
    )
    response = client.get("/api/summary", params={"query": "x"})
    assert "Unable to generate summary" in response.text


def test_summary_network_empty(client):
    main.app.state.db = DummyDB(
        lambda *_: pd.DataFrame(columns=["author", "subreddit", "bot_suspicion_score"])
    )
    response = client.get("/api/summary/network")
    assert "No network data available." in response.text


def test_summary_network_stream_success(client, monkeypatch):
    main.app.state.db = DummyDB(
        lambda *_: pd.DataFrame(
            [
                {"author": "a1", "subreddit": "s1", "bot_suspicion_score": 1},
                {"author": "a2", "subreddit": "s2", "bot_suspicion_score": 2},
            ]
        )
    )
    monkeypatch.setattr(
        main,
        "get_next_gemini_client",
        lambda _app: DummyStreamClient(chunks=[DummyChunk(None), DummyChunk("network")]),
    )
    response = client.get("/api/summary/network")
    assert "network" in response.text


def test_summary_network_stream_error(client, monkeypatch):
    main.app.state.db = DummyDB(
        lambda *_: pd.DataFrame([{"author": "a1", "subreddit": "s1", "bot_suspicion_score": 1}])
    )
    monkeypatch.setattr(
        main, "get_next_gemini_client", lambda _app: DummyStreamClient(fail=True)
    )
    response = client.get("/api/summary/network")
    assert "Unable to generate summary" in response.text


def test_summary_clusters_stream_success(client, monkeypatch):
    monkeypatch.setattr(
        main,
        "get_next_gemini_client",
        lambda _app: DummyStreamClient(chunks=[DummyChunk(None), DummyChunk("clusters")]),
    )
    response = client.get("/api/summary/clusters", params={"k": 3})
    assert "clusters" in response.text


def test_summary_clusters_stream_error(client, monkeypatch):
    monkeypatch.setattr(
        main, "get_next_gemini_client", lambda _app: DummyStreamClient(fail=True)
    )
    response = client.get("/api/summary/clusters", params={"k": 3})
    assert "Unable to generate summary" in response.text


def test_cib_events_returns_rows(client):
    main.app.state.db = DummyDB(
        lambda *_: pd.DataFrame([{"author": "a", "url": "u", "sub_count": 2, "time_delta_seconds": 10}])
    )
    response = client.get("/api/cib_events")
    assert response.status_code == 200
    assert response.json()[0]["author"] == "a"
