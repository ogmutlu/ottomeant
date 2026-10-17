"""Read-only HTTP smoke test for a built static Ottomeant deployment."""

import argparse
import json
from html.parser import HTMLParser
from urllib.parse import urljoin
from urllib.request import urlopen

from pipeline.model import parse_lexicon
from pipeline.morphology import root_id


class Document(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name == "id" and value:
                if value in self.ids:
                    raise ValueError(f"Duplicate HTML id: {value}")
                self.ids.add(value)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base_url")
    args = parser.parse_args()
    base = args.base_url.rstrip("/") + "/"

    def get(path: str) -> str:
        with urlopen(urljoin(base, path), timeout=10) as response:
            if response.status != 200:
                raise ValueError(f"HTTP {response.status}: {path}")
            return response.read().decode("utf-8")

    document = Document()
    document.feed(get("index.html"))
    required = {
        "search",
        "search-form",
        "search-submit",
        "results",
        "family",
        "known-roots",
        "status",
        "choices",
        "retry",
    }
    if not required.issubset(document.ids):
        raise ValueError(f"Missing UI elements: {required - document.ids}")
    get("style.css")
    for module in ("main", "model", "lookup", "codec", "data", "render"):
        get(f"dist/{module}.js")
    manifest = json.loads(get("public/data/manifest.json"))
    search = json.loads(get("public/data/search.json"))
    if manifest["rootCount"] != 21952 or search["buildId"] != manifest["buildId"]:
        raise ValueError("Incomplete or mixed static build")
    # First/last combinations, a known family, and a generated-only family.
    for key in ("ءءء", "ييي", "كتب", "شكز"):
        identifier = root_id(key)
        family = json.loads(get(f"public/data/roots/{identifier[:2]}/{identifier}.json"))
        if family["root"]["key"] != key or family["buildId"] != manifest["buildId"]:
            raise ValueError(f"Wrong root payload: {key}")
        # Reuse the editable-data validator to check served dictionary evidence.
        parse_lexicon(
            {"schemaVersion": 1, "roots": [family["root"]], "entries": family["dictionary"]}
        )
    print("Static HTTP checks passed: HTML, CSS, 6 modules, catalog, and 4 root families.")


if __name__ == "__main__":
    main()
