"""Read official Nişanyan entry metadata for manual lexicon curation.

This command never edits the lexicon. The regular static build stays offline.
The old nisanyan-cli API endpoint is no longer used by the current website.
"""

import argparse
import json
import time
import unicodedata
from dataclasses import asdict, dataclass
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class EntryMetadata:
    word: str
    url: str
    description: str
    checked_on: str


class MetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.description = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "meta":
            return
        attributes = dict(attrs)
        if attributes.get("name") == "og:title":
            self.title = attributes.get("content") or ""
        if attributes.get("name") == "description":
            self.description = attributes.get("content") or ""


def read_page(word: str, html: str) -> EntryMetadata:
    word = unicodedata.normalize("NFC", word.strip())
    parser = MetadataParser()
    parser.feed(html)
    if parser.title != f"{word} - Nişanyan Sözlük" or not parser.description.strip():
        raise ValueError(f"No readable Nişanyan entry for {word!r}")
    return EntryMetadata(
        word=word,
        url="https://www.nisanyansozluk.com/kelime/" + quote(word, safe=""),
        description=parser.description,
        checked_on=date.today().isoformat(),
    )


def fetch_entry(word: str) -> EntryMetadata:
    url = "https://www.nisanyansozluk.com/kelime/" + quote(word, safe="")
    request = Request(
        url,
        headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.nisanyansozluk.com/"},
    )
    with urlopen(request, timeout=20) as response:
        if response.geturl() != url:
            raise ValueError(f"Unexpected dictionary redirect for {word!r}")
        return read_page(word, response.read().decode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("words", nargs="+")
    parser.add_argument("--output", type=Path, default=Path(".cache/nisanyan-review.json"))
    args = parser.parse_args()
    words = list(dict.fromkeys(unicodedata.normalize("NFC", word.strip()) for word in args.words))

    entries: list[dict[str, str]] = []
    for index, word in enumerate(words):
        # Avoid bursts, and stop the batch when the dictionary asks us to slow down.
        if index:
            time.sleep(1)
        try:
            entries.append(asdict(fetch_entry(word)))
        except HTTPError as error:
            entries.append({"word": word, "error": str(error)})
            if error.code == 429:
                entries.extend(
                    {"word": pending, "error": "Not requested: dictionary rate limit"}
                    for pending in words[index + 1 :]
                )
                break
        except (OSError, ValueError) as error:
            entries.append({"word": word, "error": str(error)})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    errors = [entry for entry in entries if "error" in entry]
    print(f"Reviewed {len(entries) - len(errors)}/{len(entries)} official entries: {args.output}")
    if errors:
        print(json.dumps(errors, ensure_ascii=False))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
