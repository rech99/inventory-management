import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)

def broadcast_websocket_event(event_type, payload):
    """
    Broadcasts a WebSocket message to the 'inventory_updates' group.
    Fails gracefully if channels is not configured.
    """
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                'inventory_updates',
                {
                    'type': 'broadcast_event',
                    'message': {
                        'type': event_type,
                        'payload': payload
                    }
                }
            )
            logger.info(f"Broadcasted WebSocket event: {event_type}")
        else:
            logger.warning("Channel layer not found. WebSocket event not broadcasted.")
    except Exception as e:
        logger.error(f"Error broadcasting WebSocket event: {e}")
