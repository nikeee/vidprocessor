import * as path from "node:path";
import { createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import mime from "mime-types";
import errors from "http-errors";
import { Type } from "@fastify/type-provider-typebox";

import type { ServerInstance } from "./index.js";
import { buildPreview } from "./preview.js";
import config from "./config.js";

export default async function routes(server: ServerInstance) {
	server.get("/_health", async () => {
		return { status: "ok" };
	});

	server.get(
		"/preview",
		{
			schema: {
				querystring: Type.Object({
					url: Type.String(),
				}),
				response: {
					200: Type.Any(),
					400: Type.Object({
						message: Type.String(),
					}),
				},
			},
		},
		async (request, reply) => {
			const url = request.query.url;

			const res = await fetch(url, {
				method: "GET",
				headers: {
					"User-Agent": config.fetchUserAgent,
				},
			});

			if (!res.ok) {
				throw new errors.BadRequest("Could not download file");
			}

			const ab = await res.arrayBuffer();

			const u = new URL(url);
			const filename = path.basename(u.pathname);

			const result = await processFile(filename, ab);
			reply.header("Content-Type", result.mimeType);
			return reply.send(result.data);
		},
	);

	server.post(
		"/preview",
		{
			schema: {
				response: {
					200: Type.Any(),
					400: Type.Object({
						message: Type.String(),
					}),
				},
			},
		},
		async (request, reply) => {
			const data = await request.file();
			if (!data || data.type !== "file" || data.fieldname !== "video") {
				throw new errors.BadRequest("Invalid file");
			}

			const result = await processFile(data.filename, data.file);
			reply.header("Content-Type", result.mimeType);
			return reply.send(result.data);
		},
	);

	interface ConversionResult {
		data: Buffer;
		mimeType: string;
	}

	async function processFile(
		inputBaseName: string,
		input: Readable | ArrayBuffer,
	): Promise<ConversionResult> {
		const fileExtension = path.extname(inputBaseName).toLowerCase();
		if (fileExtension !== ".mp4" && fileExtension !== ".webm") {
			throw new errors.BadRequest("Invalid file");
		}

		let dir = null;
		try {
			dir = await fs.mkdtemp("conv-");

			const inFileName = `in${fileExtension}`;
			const tempInFile = path.join(dir, inFileName);

			if (input instanceof Readable) {
				await pipeline(input, createWriteStream(tempInFile));
			} else {
				await fs.writeFile(tempInFile, new DataView(input));
			}

			const outFileName = "out.mp4";
			const tempOutFile = path.join(dir, outFileName);

			await buildPreview(tempInFile, tempOutFile, {});

			const content = await fs.readFile(tempOutFile, {});
			const mimeType = mime.lookup(outFileName) || "application/octet-stream";

			return {
				data: content,
				mimeType,
			};
		} finally {
			if (dir) {
				await fs.rmdir(dir, { recursive: true });
			}
		}
	}
}
