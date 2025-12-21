# Pokedex Web App Konzept

## Ziel
- Web-Frontend zeigt nur die Pokedex-Oberfläche (Liste + Details), keine Admin-UI.
- Standard-Sortierung nach Kanto-Index; spätere Sortierungen (Typ, Alphabet, Regionen) optional.
- Alle Inhalte auf Deutsch: Namen, Beschreibungen, Typen, Attacken; Audioausgabe für Namen und Beschreibungen.

## Dateibasiertes Content-Modell
- `data/pokemon/{kanto-nummer}_{slug}.yml`: Inhalt pro Pokémon  
  - `id` (Kanto-Index), `slug`, `name.de`, `description.de`, `types` (Array), `height_m`, `weight_kg`, `abilities` (Array mit `name.de`/`description.de`), `moves` (Array mit `name`/`type`/`power`/`accuracy`/`pp`/`description.de`), `evolutions` (Liste mit Ziel-Nummer + Bedingung z. B. Level/Item/Freundschaft).
  - Evolutionen referenzieren Pokédex-Nummern (nicht Slug/Name). Die Build-Pipeline löst Nummern zu lesbaren Namen auf; fehlt die referenzierte Nummer, wird der Name als "???" angezeigt.
  - Beispiel: `apps/pokedex/data/pokemon/025_pikachu.yml` würde Evolutionen als Nummern führen (entwickelt sich aus #172, entwickelt sich zu #26).
  - Optional: `region_forms`, `sprites` (Pfad zu Bildern), `audio` (Pfad zu vorgespeicherten Audios).
- `data/types.yml`: Liste aller Typen mit `name.de`, `description.de`, Effektivität (stark/normal/schwach) gegen andere Typen.
- `data/moves.yml`: Gemeinsame Attacken-Referenz, falls Moves mehrfach genutzt werden.
- `public/assets/sprites/`: Offizielle Illustrationen/Sprites, dateibasiert (z. B. `001.png`, `025.png`, `other/official-artwork/XXX.png` wenn gewünscht). Wird von Build nach `dist/assets/sprites/` kopiert.
- `public/audio/de/pokemon/{id}.mp3` und `public/audio/de/descriptions/{id}.mp3`: Generierte Audiodateien.
- Admin erfolgt durch direktes Bearbeiten dieser Dateien (kein Backoffice). Änderungen werden versioniert.

## Frontend-Anforderungen
- Liste nach Kanto-Index (Standard), Umschaltoptionen für andere Sortierungen/Filter (Typ, Suche, Favoriten) später.
- Detailansicht pro Pokémon mit Namen (DE), Beschreibung (DE), Typ-Badges, Moves, Evolutions (mit Bedingungen), Sprite/Illustration.
- Audio-Buttons spielen Namen- und Beschreibungs-Audios ab, falls vorhanden.
- Falls Audios fehlen, UI zeigt Hinweis oder deaktivierte Buttons.
- Client lädt Daten als statische Bundles (z. B. vorgerenderte JSON-Dateien) aus `data/`/`public/`.
- Illustration-Nutzung:
  - Liste: kleines Bild neben Name/Typen (Skalierung per CSS, Pfad z. B. `assets/sprites/{id}.png`).
  - Detail: großes Bild (max-width 100%), fällt auf Placeholder zurück, falls fehlend.
- Fehlende Einträge: Wie im Spiel werden nicht vorhandene Dex-Einträge als leere Slots (nur Nummer) angezeigt und sind nicht klickbar, bis Daten vorhanden sind.
- Typfarben: Typ-Badges werden farblich nach `data/types.yml` gestaltet.

## Audio-Generierung (Deutsch)
- Ziel: Skriptgestützte TTS-Generierung, reproduzierbar und dateibasiert.
- Vorschlag: `scripts/generate_audio.sh` nutzt `espeak-ng` (oder `piper` falls verfügbar) ohne Netzwerk.
- Beispiel-Workflow:
  ```bash
  # Name
  espeak-ng -v de -s 150 -w public/audio/de/pokemon/001.wav "Bisasam"
  # Beschreibung
  espeak-ng -v de -s 150 -w public/audio/de/descriptions/001.wav "$(yq '.description.de' data/pokemon/001_bisasam.yml)"
  ffmpeg -i public/audio/de/descriptions/001.wav -ar 44100 -ac 2 public/audio/de/descriptions/001.mp3
  ```
  - `yq` zum Auslesen der deutschen Texte; `ffmpeg` für MP3-Kompression. Alternativ direkt WAV abspielen, wenn MP3 nicht nötig.
  - Skript iteriert über alle Pokémon-Dateien, erzeugt fehlende Audios, lässt bestehende unberührt.
  - Optionale Hash-Datei (`data/audio_manifest.json`) um nur geänderte Texte neu zu rendern.

## Admin-Flow (Dateisystem)
- Inhalte anpassen: YAML-Dateien unter `data/` bearbeiten (Namen, Beschreibungen, Typen, Moves).
- Neue Pokémon: YAML-Datei hinzufügen, Sprite ablegen, Skript ausführen, Audios prüfen.
- Audio neu erzeugen: `scripts/generate_audio.sh --force` oder automatisch, wenn Text geändert.
- Deployment: Statische Assets (`public/`) und Daten (`data/`) werden mit ausgeliefert; Frontend liest nur diese Quellen.

## Erweiterungen (optional)
- Weitere Regionen/Sets als eigene Verzeichnisse (`data/pokemon_johto/` etc.).
- Lokalisierung: zusätzliche Sprachordner analog zu `public/audio/de` und `name.de`/`description.de`.
- Performance: Vorab kompiliertes JSON pro Region für schnelle Ladezeiten.
- Barrierefreiheit: Untertitel für Audio, Tastatursteuerung, hohe Kontraste.
