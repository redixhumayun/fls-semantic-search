# fls-semantic-search

## Storage Structure

Experiments are stored in Cloudflare R2 under the following path format:

```
fls-experiments/YYYY-MM-DD/HH-MM-SS_type/
├── metadata.json
├── logs/
│   └── fls_001.log
└── video.mp4
```

The timestamp is UTC, taken at the moment `fls-upload` is run.

## Contributing

This project uses [Google style docstrings](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings).
