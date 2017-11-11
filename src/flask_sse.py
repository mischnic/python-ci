import random, string, json

from collections import deque
from flask import Response, request
from gevent.queue import Queue
import gevent

from typing import Optional, Iterable, List; assert List


def generate_id(size: int = 6, chars: str = string.ascii_lowercase + string.digits) -> str:
    return ''.join(random.choice(chars) for _ in range(size))


class ServerSentEvent(object):
    """Class to handle server-sent events."""
    def __init__(self, data: str, event: str) -> None:
        self.data = data
        self.event = event
        self.event_id = generate_id()
        self.desc_map = {
            self.data: "data",
            self.event: "event",
            self.event_id: "id"
        }

    def encode(self):
        """Encodes events as a string."""
        if not self.data:
            return ""
        lines = ["{}: {}".format(name, key)
                 for key, name in self.desc_map.items() if key]

        return "{}\n\n".format("\n".join(lines))

class Comment(object):
    def __init__(self, msg: str) -> None:
        self.msg = msg
        self.event_id = generate_id()

    def encode(self) -> str:
        return ": "+self.msg+"\n\n"


class Channel(object):
    def __init__(self, history_size: int = 32) -> None:
        self.subscriptions = [] #type: List[Queue]
        self.history = deque(maxlen=history_size)  #type: deque
        self.history.append(ServerSentEvent('start_of_history', None))

    def notify(self, message: str) -> None:
        """Notify all subscribers with message."""
        for sub in self.subscriptions[:]:
            sub.put(message)

    def event_generator(self, last_id: Optional[str]) -> Iterable[ServerSentEvent]:
        """Yields encoded ServerSentEvents."""
        q = Queue()
        self._add_history(q, last_id)
        self.subscriptions.append(q)
        try:
            while True:
                yield q.get()
        except GeneratorExit:
            self.subscriptions.remove(q)

    def subscribe(self):
        def gen(last_id: Optional[str]):
            for sse in self.event_generator(last_id):
                yield sse.encode()
        return Response(
            gen(request.headers.get('Last-Event-ID')),
            mimetype="text/event-stream")

    def _add_history(self, q: Queue, last_id: Optional[str]) -> None:
        add = False # last_id is None
        for sse in self.history:
            if add:
                q.put(sse)
            if sse.event_id == last_id:
                add = True

    def publish(self, event: str, message: dict) -> None:
        sse = ServerSentEvent(json.dumps(message), event)
        self.history.append(sse)
        gevent.spawn(self.notify, sse)

    def comment(self, msg: str = "") -> None:
        sse = Comment(msg)
        self.history.append(sse)
        gevent.spawn(self.notify, sse)

    def get_last_id(self) -> str:
        return self.history[-1].event_id