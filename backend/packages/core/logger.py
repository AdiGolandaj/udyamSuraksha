"""
Logging Configuration

Centralized structured logging using Python's logging module.
Supports both JSON and text-based log output.
"""
import logging
import json
import sys
from datetime import datetime
from typing import Optional


class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        """Format a log record as JSON."""
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id

        return json.dumps(log_data)


class TextFormatter(logging.Formatter):
    """Custom text formatter for human-readable logging."""

    COLORS = {
        "DEBUG": "\033[36m",    # Cyan
        "INFO": "\033[32m",     # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",    # Red
        "CRITICAL": "\033[41m", # Red background
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        """Format a log record as colored text."""
        if sys.stdout.isatty():
            color = self.COLORS.get(record.levelname, self.RESET)
            return (
                f"{color}[{record.levelname:8}]{self.RESET} "
                f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} "
                f"{record.name}: {record.getMessage()}"
            )
        else:
            return (
                f"[{record.levelname:8}] "
                f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} "
                f"{record.name}: {record.getMessage()}"
            )


def setup_logger(name: Optional[str] = None) -> logging.Logger:
    """
    Setup and configure a logger.

    Args:
        name: Logger name (typically __name__ from module)

    Returns:
        Configured logger instance
    """
    from .config import settings  # Import here to avoid circular import

    logger = logging.getLogger(name or __name__)
    logger.setLevel(settings.LOG_LEVEL)

    # Avoid adding duplicate handlers
    if logger.handlers:
        return logger

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(settings.LOG_LEVEL)

    # Select formatter based on LOG_FORMAT setting
    if settings.LOG_FORMAT == "json":
        formatter = JSONFormatter()
    else:
        formatter = TextFormatter()

    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    return logger


# Backward compatibility
def get_logger(name: str) -> logging.Logger:
    """Legacy function for backward compatibility."""
    return setup_logger(name)
