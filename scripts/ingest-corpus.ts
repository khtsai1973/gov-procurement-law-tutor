import { ingestCorpus } from "../src/lib/ingest";

async function main() {
  const result = await ingestCorpus("cli");
  console.log(
    `Knowledge base loaded: regulations=${result.regulationCount}, chunks=${result.chunkTotal}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
