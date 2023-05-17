import type { FastifyServerOptions } from "fastify";

const envToLogger = {
	development: {
		level: "debug",
		transport: {
			target: "pino-pretty",
			options: {
				translateTime: "HH:MM:ss Z",
				ignore: "pid,hostname",
			},
		},
	},
	production: true,
	test: false,
} as Record<string, FastifyServerOptions["logger"]>;

const mib = 1024 * 1024;

export default {
	port: Number(process.env.API_PORT ?? "8080"),
	host: process.env.API_HOST ?? "0.0.0.0",
	logger: envToLogger[process.env.NODE_ENV ?? "development"] ?? true,
	maxFileSize: mib * 500,
	fetchUserAgent:
		process.env.FETCH_USER_AGENT ??
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
};
