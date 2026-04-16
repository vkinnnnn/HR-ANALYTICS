"""Memory Manager — Per-user persistent memory using Mem0."""

from typing import Optional, List

class MemoryManager:
    """Simple in-memory memory store (Mem0 integration optional)."""
    
    def __init__(self):
        self.memories = {}  # user_id -> list of facts
    
    def search(self, user_id: str, query: str) -> List[str]:
        """Retrieve relevant memories for user."""
        if user_id not in self.memories:
            return []
        return [m for m in self.memories[user_id] if query.lower() in m.lower()]
    
    def save(self, user_id: str, fact: str) -> bool:
        """Save a fact to user's persistent memory."""
        if user_id not in self.memories:
            self.memories[user_id] = []
        if fact not in self.memories[user_id]:
            self.memories[user_id].append(fact)
        return True
    
    def clear(self, user_id: str) -> bool:
        """Clear all memories for a user (GDPR)."""
        if user_id in self.memories:
            del self.memories[user_id]
        return True
    
    def get_all(self, user_id: str) -> List[str]:
        """Get all memories for a user."""
        return self.memories.get(user_id, [])

memory_manager = MemoryManager()
