import fastify from "fastify";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

import config from "./config.js";
import routes from "./routes.js";

const server = fastify({
	logger: config.logger,
}).withTypeProvider<TypeBoxTypeProvider>();

export type ServerInstance = typeof server;

server.register(multipart, {
	limits: {
		files: 1,
		fileSize: config.maxFileSize,
	},
});

server.register(swagger, {
	mode: "dynamic",
	prefix: "/docs",
	openapi: {
		info: {
			title: "vidprocessor API",
			version: "0.1.0",
		},
	},
});

server.register(swaggerUi, {
	routePrefix: "/docs",
	uiConfig: {
		docExpansion: "full",
		deepLinking: false,
	},
});

server.register(routes);

function closeGracefully(signal: string) {
	server.log.info(`Received ${signal}. Closing gracefully...`);
	server.close().then(
		() => {
			server.log.info("Server closed gracefully.");
			process.kill(process.pid, signal);
		},
		(err) => {
			server.log.error("Error while closing server gracefully.", err);
			process.kill(process.pid, signal);
		},
	);
}

process.once("SIGINT", closeGracefully);
process.once("SIGTERM", closeGracefully);

await server.listen({ port: config.port, host: config.host });

await server.ready();

server.log.info("vidprocessor started");
