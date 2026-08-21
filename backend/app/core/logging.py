"""
Logging estructurado (spec, sección 9):
"Logging estructurado con request_id; texto de entrada nunca en claro — hash
sha256 + longitud en caracteres."
"""

import hashlib
import logging
import sys
from typing import Any, Dict, Optional

LOGGER_NAME = "calculadora_cientifica"


def configure_logging(level: int = logging.INFO) -> None:
    """Configura el logger raíz de la aplicación con salida estructurada."""
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(fmt="%(asctime)s level=%(levelname)s logger=%(name)s %(message)s")
    handler.setFormatter(formatter)

    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(level)
    logger.handlers = [handler]
    logger.propagate = False


def get_logger() -> logging.Logger:
    return logging.getLogger(LOGGER_NAME)


def hash_input_text(text: str) -> str:
    """Hash sha256 hexadecimal de un texto de entrada de usuario.

    Nunca se loguea el texto en claro (spec, sección 9) — solo este hash y su
    longitud, vía `log_request_event`.
    """
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def log_request_event(
    request_id: str,
    event: str,
    input_text: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    """Emite un evento de log estructurado asociado a un request_id.

    Si se pasa `input_text`, se registra únicamente su hash sha256 y su
    longitud en caracteres — nunca el texto original.
    """
    logger = get_logger()
    fields: Dict[str, Any] = {"request_id": request_id, "event": event}
    if input_text is not None:
        fields["input_sha256"] = hash_input_text(input_text)
        fields["input_length"] = len(input_text)
    if extra:
        fields.update(extra)

    message = " ".join(f"{key}={value}" for key, value in fields.items())
    logger.info(message)
