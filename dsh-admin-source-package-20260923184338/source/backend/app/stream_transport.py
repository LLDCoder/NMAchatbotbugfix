"""Keep a subscribed transport alive without inventing job progress."""
import asyncio


async def forward_events_with_heartbeat(conversation_id, queue, send, *, interval=20):
    while True:
        try:
            event = await asyncio.wait_for(queue.get(), timeout=interval)
        except TimeoutError:
            await send({'type': 'heartbeat', 'conversationId': conversation_id})
        else:
            await send({'type': 'event', **event})
