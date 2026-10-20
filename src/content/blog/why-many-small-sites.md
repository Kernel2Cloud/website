---
title: Engineering one GPU pool out of many small sites
description: Why one copy runs on one server, how PCIe shapes tensor parallelism, what a WAN cannot carry, and how replicas across sites become availability.
pubDate: 2026-10-20
author: Kernel2Cloud team
tags: [gpu-cloud, inference, architecture]
draft: false
---

A data center is one failure domain with a very fast fabric. A pool of small sites is many failure domains with a slow one. Almost every design decision in Kernel2Cloud follows from taking that difference seriously instead of hiding it.

This post walks through the reasoning: what one server can hold, why we stop parallelism at the server boundary, how replicas across sites turn into availability, and what the control plane has to do when the hardware is in someone's backyard. The numbers are back-of-envelope estimates with the assumptions stated, not benchmarks.

## The unit of deployment is one server

A Kernel2Cloud rack is a 1U control plane plus one GPU server with 8 to 16 NVIDIA RTX PRO 6000 Blackwell GPUs. Each GPU has 96 GB of GDDR7 with ECC and roughly 1.8 TB/s of memory bandwidth. The GPUs talk to each other over PCIe, not NVLink.

That gives a server 768 GB to 1.5 TB of GPU memory. A *copy* of a deployment, the unit the scheduler places, runs on exactly one server and may use some or all of its GPUs. We do not offer models that span servers. The rest of this post is largely the argument for why that is the right boundary.

### What fits

Weights dominate the budget, so a first-order fit check is `parameters × bytes per parameter`:

| Model | BF16 | FP8 | FP4 (approx.) | Smallest fit |
|---|---|---|---|---|
| 8B dense | 16 GB | 8 GB | 4 GB | 1 GPU |
| 32B dense | 64 GB | 32 GB | 16 GB | 1 GPU (FP8/FP4) |
| 72B dense | 144 GB | 72 GB | 36 GB | 2 GPUs BF16, 1 GPU FP8 |
| 405B dense | 810 GB | 405 GB | ~203 GB | 16-GPU server BF16, 8-GPU server FP8 |
| 671B MoE | 1.34 TB | 671 GB | ~336 GB | 8-GPU server at FP8 and below |

These are weights only. The rest of the memory goes to activations, the CUDA context, and the KV cache, and the KV cache is what actually limits concurrency.

### The KV cache sets your batch size

For a transformer with grouped-query attention, the KV cache costs, per token:

```text
bytes_per_token = 2 (K and V) × layers × kv_heads × head_dim × bytes_per_element
```

For Qwen2.5-72B (80 layers, 8 KV heads, head dimension 128) in BF16 that is `2 × 80 × 8 × 128 × 2 = 327,680 bytes`, about 320 KiB per token. Two GPUs give 192 GB. At a typical 90% memory-utilisation target that is about 173 GB usable. Subtract 144 GB of BF16 weights and about 29 GB remains, roughly 90,000 tokens of cache across all concurrent sequences, or about 22 sequences at 4k tokens.

Quantising the weights to FP8 frees 72 GB on the same two GPUs and more than triples that cache budget. This is why the FP8 and FP4 paths on Blackwell matter commercially, not just for speed: they convert directly into concurrent users per server.

## Decode is a memory-bandwidth problem

Autoregressive decoding reads every weight once per step to produce one token per sequence. Arithmetic intensity is proportional to batch size, so at the batch sizes a single copy sees, decode sits far below the compute roof of the GPU and on the bandwidth slope of the roofline. A lower bound on step time is:

```text
t_step ≥ weight_bytes_per_GPU / memory_bandwidth
```

For 72B in BF16 on two GPUs that is `72 GB / 1.8 TB/s ≈ 40 ms` before any communication.

## Tensor parallelism over PCIe has a price

Megatron-style tensor parallelism splits each layer across GPUs and needs two all-reduces per transformer layer in the forward pass, one after attention and one after the MLP. For an 80-layer model that is about 160 all-reduces per decode step.

With a decode batch of 64 and hidden size 8192 in BF16, each all-reduce moves `64 × 8192 × 2 B = 1 MiB`. A ring all-reduce over `p` GPUs costs:

```text
t_ar ≈ 2(p−1)/p × S / B_link  +  2(p−1) × α
```

Take `B_link ≈ 50 GB/s` (a PCIe Gen5 x16 link is about 63 GB/s per direction before protocol overhead) and a per-step latency `α ≈ 5 µs`. Then, per decode step:

| TP degree | Weights per GPU | Weight read | 160 × all-reduce | Step time | Communication share |
|---|---|---|---|---|---|
| 2 | 72 GB | 40 ms | 5.0 ms | 45 ms | 11% |
| 4 | 36 GB | 20 ms | 9.8 ms | 30 ms | 33% |
| 8 | 18 GB | 10 ms | 17.1 ms | 27 ms | 63% |

Going from TP=4 to TP=8 doubles the GPUs and improves step latency by about 10%. On a fabric without NVLink-class bandwidth, tensor parallelism hits diminishing returns early: the all-reduce latency term grows linearly with `p` while the weight-read term shrinks as `1/p`.

The practical rule that falls out: **use the smallest tensor-parallel degree that fits weights plus a useful KV cache, and buy throughput with replicas.** At a fixed batch of 64 per replica, four TP=2 replicas on an 8-GPU server produce about `4 × 64 / 45 ms ≈ 5,700 tokens/s`, against about 2,400 tokens/s for one TP=8 replica. A wide replica can use its extra memory for a larger batch, but that moves it toward the compute roof, which is a different trade (more aggregate throughput per replica, worse per-user latency). Real numbers also depend on topology: GPUs under one PCIe switch can use peer-to-peer transfers, while traffic that crosses root complexes goes through the CPU interconnect.

## Why the server is the parallelism boundary

If PCIe is already the constraint, why not span servers and run bigger models? Because the next fabric down is not slower by a factor of ten, it is slower by orders of magnitude, and it is slower in latency, which is what collective operations are sensitive to.

- **Tensor parallelism over a WAN is not viable.** An intra-server all-reduce completes in tens of microseconds. A WAN round trip is 10 to 50 ms, roughly a thousand times longer, and you would pay it 160 times per token.
- **Pipeline parallelism pays a round trip per stage per token.** The activations are small (`batch × hidden`), so bandwidth is fine, but per-token latency becomes the sum of the stage-to-stage round trips, and a single-stream decode cannot hide it.
- **Prefill/decode disaggregation has to ship the KV cache.** An 8,192-token prompt on the 72B model produces `8192 × 327,680 B ≈ 2.7 GB` of cache. Over a 1 Gb/s link that is about 21 seconds; at 10 Gb/s about 2 seconds. Both are well past a time-to-first-token budget.

Inside a data center, RDMA fabrics make these designs workable. Across sites they do not. So we put the boundary where the physics puts it, and we say plainly that models spanning several servers aren't offered yet. Within a server, the product exposes up to 16 GPUs and 1.5 TB of GPU memory per copy.

## Scale out with replicas, not with fabric

Data parallelism is the one form of parallelism that needs no inter-replica communication. Each copy holds a full set of weights, serves independent requests, and shares nothing but a load balancer. That is exactly the property a pool of loosely connected sites needs.

The request path is short. A deployment gets a hostname, `<deployment>-<buyer>.apps.kernel2cloud.ai`, and the HTTPS gateway only answers requests carrying one of the buyer's API keys. Traffic is balanced across copies that pass their readiness probe. The cost of the extra hop is small against LLM latencies: time to first token is dominated by prefill (tens to hundreds of milliseconds), and tokens stream back over a long-lived response.

### Placement is anti-affinity

The scheduler places each copy on a server with enough free GPUs and spreads the copies of one deployment across racks. This is the same anti-affinity constraint Kubernetes exposes as topology spread, with the rack as the failure domain. We give each buyer whole servers, so there is no GPU time-slicing between tenants, no MIG partitioning to reason about, and no noisy-neighbour term in latency.

### What replicas buy in availability

If racks failed independently with availability `a`, `n` copies across `n` racks would give:

```text
A_pool = 1 − (1 − a)^n
```

With an illustrative `a = 0.99` per rack, that is 99.99% for two copies and 99.9999% for three. Those numbers should make you suspicious, and the reason is the interesting part. Failures are not independent: a regional ISP incident, a bad rollout, or an outage in the shared gateway and control plane hits many racks at once. The honest model is:

```text
A_service ≈ A_shared × (1 − Π(1 − a_i))
```

Once you have two or three copies, the `A_shared` term dominates. Replica count stops being the lever; the reliability of whatever the copies have in common is. That is why we treat the shared components, the gateway, scheduler and deployment pipeline, as the part that has to be engineered most carefully, and why we do not quote availability figures from the independent-failure formula.

### Rolling out without spare capacity

Because every copy owns a whole server, a rollout cannot surge: there may be no free server to start the new version on. The scheduler therefore replaces one copy per pass and pauses if the new version cannot start. Capacity dips by one copy during a rollout, which is why a deployment with a single copy has no zero-downtime update and why two or more copies matter operationally, not just for availability.

## What the control plane has to assume

The hardware sits on residential power and internet in places we do not physically control. That removes several assumptions a data center operator gets for free.

**Immutable, declarative nodes.** Every server boots an immutable operating-system image (Kairos with k3s). There is no package manager to drift and no snowflake configuration. Changing a node means shipping an image.

**Outbound-only connectivity.** Racks initiate the connection to the platform. We do not rely on opening inbound ports at a site, and remote terminals on racks work without them.

**Admission by approval.** A new rack registers itself and waits. Nothing is scheduled onto it until an operator approves it, so a rack that merely powers on cannot join the pool.

**Isolation by node.** Buyers get whole servers on hardened Kubernetes, containers cannot override GPU driver settings, and each buyer sees only their own deployments and logs.

**Telemetry that survives the site.** DCGM exports per-GPU health and temperature; metrics are kept centrally for every rack, and alert rules turn thermal and GPU faults into alerts for our operators. When a server goes down, the scheduler starts its copies on other servers, and when a whole site drops off, the pool shrinks instead of failing. Usage is metered per buyer, deployment and GPU model, in GPU-time per hour, written on each agent sync so the figure the buyer sees comes from the same source as the scheduler's.

## What we do not claim

We do not offer models that span several servers, and the interconnect inside a server is PCIe. If your workload is a single 1T-parameter dense model at maximum batch, or a training run with a global all-reduce, a pool of small sites is the wrong tool and we would rather say so.

Where it fits is the large and growing class of serving workloads that are bandwidth-bound per replica, memory-bound on KV cache, tolerant of tens of milliseconds of network, and scaled by adding copies. For those, many small sites with a clear failure-domain model are a reasonable way to get GPUs onto power that already exists.

## Where to go next

See [how deploying works](/compute/) and the [hardware per copy](/compute/#deploy), or read how the [platform](/platform/) handles scheduling, GPU health and security. If you have space and power for a rack, [we'd like to hear from you](/host-a-rack/).
