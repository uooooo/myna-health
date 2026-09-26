import { createSyntheticFixture } from "../src/index.ts";

const fixture = await createSyntheticFixture();
await Bun.write(new URL("../artifacts/synthetic-fixture.json", import.meta.url), `${JSON.stringify(fixture, null, 2)}\n`);
console.log("Wrote artifacts/synthetic-fixture.json (synthetic medical record only)");
