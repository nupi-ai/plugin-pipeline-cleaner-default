# Nupi Default Pipeline Cleaner

Default content pipeline cleaner plugin for the Nupi platform. Normalizes and cleans terminal output before it enters the conversation engine.

## Plugin Type

`pipeline-cleaner` — JS plugin executed by the Nupi daemon's bundled Bun runtime.

## Installation

Place this directory under `~/.nupi/instances/default/plugins/` or install via `nupi install-local`.

## Files

- `main.js` — Plugin entry point with `transform` function
- `plugin.yaml` — NAP manifest (`pipeline-cleaner` type)

## License

See [LICENSE](LICENSE).
