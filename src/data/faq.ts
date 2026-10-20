export const faq = [
  { q: "What GPUs do you run?", a: "NVIDIA RTX PRO 6000 Blackwell with 96 GB each. Every rack has one server with 8 to 16 of them — 768 GB to 1.5 TB of GPU memory — connected over PCIe." },
  { q: "How large a model can I run?", a: "One copy runs on one server, so up to 16 GPUs and 1.5 TB of GPU memory per copy (more with FP4 weights). Models that span several servers aren't offered yet. Run more copies to serve more traffic." },
  { q: "What happens if a site goes offline?", a: "Copies of your deployment run on different racks, and the gateway sends traffic only to copies that are ready. If a rack drops off, the others keep answering while the scheduler replaces the missing copy." },
  { q: "Do I share servers with other customers?", a: "No. Each buyer gets whole servers, and you only see your own deployments and logs." },
  { q: "How is compute priced?", a: "Pricing depends on your workload. Get in touch and tell us what you need." },
  { q: "What do I need to host a rack?", a: "A dry, covered space with a suitable electrical supply. We provide the hardware and the internet connection, and assess every site before installing." },
];
