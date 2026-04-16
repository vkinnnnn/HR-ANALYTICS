"""Error handling and recovery utilities."""

import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

logger = logging.getLogger(__name__)

class WorkforceError(Exception):
    """Base exception for Workforce IQ."""
    pass

class DataNotLoadedError(WorkforceError):
    """Raised when data hasn't been loaded yet."""
    pass

class AnalyticsError(WorkforceError):
    """Raised when analytics query fails."""
    pass

class KnowledgeBaseError(WorkforceError):
    """Raised when knowledge base operations fail."""
    pass

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with detailed responses."""
    logger.warning(f"Validation error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Invalid request format",
            "errors": [
                {"loc": list(error["loc"]), "msg": error["msg"]}
                for error in exc.errors()
            ]
        }
    )

async def workforce_error_handler(request: Request, exc: WorkforceError):
    """Handle WorkforceError with proper status codes."""
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    if isinstance(exc, DataNotLoadedError):
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    elif isinstance(exc, (AnalyticsError, KnowledgeBaseError)):
        status_code = status.HTTP_400_BAD_REQUEST

    logger.error(f"Workforce error: {exc}")
    return JSONResponse(
        status_code=status_code,
        content={"error": str(exc)}
    )

async def general_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions."""
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal server error"}
    )

def configure_error_handlers(app):
    """Register error handlers with FastAPI app."""
    from fastapi.exceptions import RequestValidationError
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(WorkforceError, workforce_error_handler)
    app.add_exception_handler(Exception, general_exception_handler)

def setup_logging():
    """Configure logging for the application."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    # Reduce noise from certain libraries
    logging.getLogger("chromadb").setLevel(logging.WARNING)
    logging.getLogger("sentence_transformers").setLevel(logging.WARNING)
