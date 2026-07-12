import time
import uuid
import json
import logging

logger = logging.getLogger("partition_tree")

class Timer:
    def __init__(self):
        self.t0 = time.perf_counter()

    def ms(self) -> int:
        return int((time.perf_counter() - self.t0) * 1000)


def log_event(event: str, **fields):
    logger.info(json.dumps({
        "event": event,
        **fields
    }, default=str))