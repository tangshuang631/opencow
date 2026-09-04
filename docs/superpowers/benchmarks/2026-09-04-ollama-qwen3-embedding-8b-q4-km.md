# Ollama Embedding Runtime Baseline

> Captured: 2026-09-04 (Asia/Shanghai)
>
> Purpose: reproducible local benchmark evidence for planning and WP4 validation. This is not a product hard-coded model requirement.

## Environment

| Field | Value |
| --- | --- |
| Host | macOS Apple Silicon (`arm64`) |
| Unified memory | 24 GiB |
| Ollama | `0.33.3` (latest local runtime observed on 2026-09-04) |
| Endpoint | `http://127.0.0.1:11434` (loopback) |
| Model | `qwen3-embedding:8b-q4_K_M` |
| Model digest | `64b933495768fbd3b87c20583d379728a07471e0c66733a9df87cd1901b3c44b` |
| Format / quantization | GGUF / Q4_K_M |
| Parameter metadata | 7.6B |
| Model context metadata | 40,960 (`qwen3.context_length`) |
| Embedding dimension | 4,096 (`qwen3.embedding_length`) |
| Ollama capability metadata | `embedding` (the `/api/show` response also reports `tools`) |

## API verification

- `/api/show` and `/api/tags` agree on the model digest above.
- `/api/embed` accepted a two-item batch and returned two vectors of dimension 4,096.
- The latest `OPENCOW_OLLAMA_EMBED_MODEL=qwen3-embedding:8b-q4_K_M npm run benchmark:ollama` run on Ollama `0.33.3` completed through the native `/api/embed` path with a 4,096-dimensional result and measured one-item latency of about `2,994.7ms`; this sample is machine-state dependent and is not a warm-latency claim.
- The earlier `0.33.2` warm probe (`total_duration=173,693,500ns`, `load_duration=4,243,542ns`) remains historical and is not compared directly with the new sample.
- `/api/ps` observed the active model at a 32,768 runtime context and `size_vram=10,946,514,779` bytes. This is residency observation, not a locality attestation and not a claim that the full model is permanently GPU-resident.

## Selection decision

Use this model as the current local quality-first embedding candidate for WP4 experiments. Its 4.7GB artifact and 24GB unified-memory host leave room for a chat model, while 4,096 dimensions and multilingual training are useful for Chinese/English/code retrieval. Product selection remains metadata/probe/benchmark driven; if memory pressure or batch throughput is poor, the allowed fallback is a separately benchmarked official Qwen3 Embedding 4B or another verified Ollama embedding model. No vector index may mix digests or dimensions.

## Reproduction

```text
ollama show qwen3-embedding:8b-q4_K_M
curl http://127.0.0.1:11434/api/embed -H 'content-type: application/json' \
  --data '{"model":"qwen3-embedding:8b-q4_K_M","input":["OpenCow 本地优先安全运行时","CowCore RAG evidence"]}'
OPENCOW_OLLAMA_EMBED_MODEL=qwen3-embedding:8b-q4_K_M npm run benchmark:ollama
```

All measurements are machine-state dependent. Repeat cold/warm probes after any Ollama, model, OS, power, memory-pressure, or context change.
