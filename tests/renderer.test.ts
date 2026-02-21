import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { RendererAgent } from "../src/agents/renderer";

describe("Renderer Agent (Puppeteer)", () => {
	let renderer: RendererAgent;
	let server: ReturnType<typeof Bun.serve>;
	const port = 3001;

	beforeAll(async () => {
		// Start a simple HTTP server serving an SPA
		server = Bun.serve({
			port,
			fetch(req) {
				return new Response(
					`<!DOCTYPE html>
<html>
<head>
  <title>SPA Test</title>
</head>
<body>
  <div id="root">Loading...</div>
  <script>
    setTimeout(() => {
      document.getElementById('root').innerHTML = '<h1>Hello Rendered World!</h1><a href="/rendered-link">link</a>';
    }, 500);
  </script>
</body>
</html>`,
					{ headers: { "Content-Type": "text/html" } },
				);
			},
		});

		renderer = new RendererAgent();
		await renderer.init();
	});

	afterAll(async () => {
		await renderer.close();
		server.stop();
	});

	test("should execute JavaScript and wait for network idle", async () => {
		const url = `http://localhost:${port}/`;
		const html = await renderer.render(url);

		// Ensure it extracted the fully rendered HTML after the timeout script executed
		expect(html).toContain("<h1>Hello Rendered World!</h1>");
		expect(html).toContain("rendered-link");
		expect(html).not.toContain("Loading...");
	});
});
