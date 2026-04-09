import "reflect-metadata";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors();

  try {
    const config = new DocumentBuilder()
      .setTitle("AI Call Handling Backend")
      .setDescription("Backend APIs for AI call handling SaaS")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("docs", app, document);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Swagger setup error";
    logger.warn(`Swagger setup skipped: ${message}`);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
