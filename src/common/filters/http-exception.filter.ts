import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json({
        statusCode: exception.getStatus(),
        path: request.url,
        timestamp: new Date().toISOString(),
        error: exception.getResponse(),
      });
      return;
    }

    if (exception instanceof Error) {
      this.logger.error(`${request.method} ${request.url} failed: ${exception.message}`, exception.stack);
    } else {
      this.logger.error(`${request.method} ${request.url} failed with non-Error exception`);
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      path: request.url,
      timestamp: new Date().toISOString(),
      error: "Internal server error",
    });
  }
}
