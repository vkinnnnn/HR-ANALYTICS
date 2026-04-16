"""Memory Manager — Per-user persistent memory with SQLite backend."""

import sqlite3
import os
import logging
from typing import Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = os.environ.get("MEMORY_DB_PATH", ".claude/memory.db")

class MemoryManager:
    """Persistent memory store using SQLite."""

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._conn = None
        self._is_memory_db = db_path == ":memory:"

        if not self._is_memory_db:
            os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else ".", exist_ok=True)

        self._init_db()

    def _get_connection(self):
        """Get or create database connection."""
        if self._is_memory_db:
            # For in-memory DB, maintain a single persistent connection
            if self._conn is None:
                self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
            return self._conn
        else:
            # For file-based DB, create a new connection for each operation
            return sqlite3.connect(self.db_path)

    def _close_connection(self, conn):
        """Close connection if it's not the persistent in-memory one."""
        if not self._is_memory_db and conn:
            conn.close()

    def _init_db(self):
        """Initialize database schema."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # Create tables if they don't exist
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS memories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    fact TEXT NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )
            """)
            conn.commit()
            self._close_connection(conn)
            logger.debug(f"Memory database initialized at {self.db_path}")
        except sqlite3.Error as e:
            logger.error(f"Failed to initialize memory database: {e}")
            raise

    def search(self, user_id: str, query: str) -> List[str]:
        """Retrieve relevant memories for user."""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query_lower = query.lower()
            cursor.execute(
                "SELECT fact FROM memories WHERE user_id = ? AND LOWER(fact) LIKE ?",
                (user_id, f"%{query_lower}%")
            )
            results = [row["fact"] for row in cursor.fetchall()]
            self._close_connection(conn)
            return results
        except sqlite3.Error as e:
            logger.error(f"Error searching memories for {user_id}: {e}")
            return []

    def save(self, user_id: str, fact: str) -> bool:
        """Save a fact to user's persistent memory."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # Ensure user exists
            cursor.execute("INSERT OR IGNORE INTO users (id) VALUES (?)", (user_id,))

            # Insert memory (ignore duplicates)
            cursor.execute(
                "INSERT OR IGNORE INTO memories (user_id, fact) VALUES (?, ?)",
                (user_id, fact)
            )
            conn.commit()
            self._close_connection(conn)
            logger.debug(f"Saved memory for {user_id}")
            return True
        except sqlite3.Error as e:
            logger.error(f"Error saving memory for {user_id}: {e}")
            return False

    def clear(self, user_id: str) -> bool:
        """Clear all memories for a user (GDPR)."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM memories WHERE user_id = ?", (user_id,))
            conn.commit()
            self._close_connection(conn)
            logger.info(f"Cleared all memories for {user_id}")
            return True
        except sqlite3.Error as e:
            logger.error(f"Error clearing memories for {user_id}: {e}")
            return False

    def get_all(self, user_id: str) -> List[str]:
        """Get all memories for a user."""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT fact FROM memories WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,)
            )
            results = [row["fact"] for row in cursor.fetchall()]
            self._close_connection(conn)
            return results
        except sqlite3.Error as e:
            logger.error(f"Error retrieving memories for {user_id}: {e}")
            return []

    def get_stats(self) -> dict:
        """Get memory statistics."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(DISTINCT user_id) as unique_users FROM memories")
            unique_users = cursor.fetchone()[0] or 0
            cursor.execute("SELECT COUNT(*) as total_facts FROM memories")
            total_facts = cursor.fetchone()[0] or 0
            self._close_connection(conn)
            return {"unique_users": unique_users, "total_facts": total_facts}
        except sqlite3.Error as e:
            logger.error(f"Error getting memory stats: {e}")
            return {"unique_users": 0, "total_facts": 0}

memory_manager = MemoryManager()
